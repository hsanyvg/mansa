"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, query, where, orderBy, Timestamp } from 'firebase/firestore';
import CalendarPicker from './CalendarPicker';

export default function BulkTransferPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [transfersHistory, setTransfersHistory] = useState<any[]>([]);
  
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [destinationStoreId, setDestinationStoreId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Date Filtering State
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(lastWeek);
  const [endDate, setEndDate] = useState(today);
  
  const [activeCalendar, setActiveCalendar] = useState<'start' | 'end' | null>(null);
  
  const [transferQuantities, setTransferQuantities] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });
  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);

  // Custom Date UI Helpers
  const parseDateToParts = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return { year: parseInt(y), month: parseInt(m), day: parseInt(d) };
  };

  const startParts = parseDateToParts(startDate);
  const endParts = parseDateToParts(endDate);

  const updatePart = (type: 'start' | 'end', part: 'year' | 'month' | 'day', val: number) => {
    const current = type === 'start' ? parseDateToParts(startDate) : parseDateToParts(endDate);
    const updated = { ...current, [part]: val };
    const dateStr = `${updated.year}-${updated.month.toString().padStart(2, '0')}-${updated.day.toString().padStart(2, '0')}`;
    if (type === 'start') setStartDate(dateStr);
    else setEndDate(dateStr);
  };

  const years = Array.from({ length: 11 }, (_, i) => 2020 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getDays = (y: number, m: number) => new Date(y, m, 0).getDate();

  // Fetch Data
  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubStores();
      unsubProducts();
    };
  }, []);

  // Fetch Transfers History within date range
  useEffect(() => {
    // Convert string dates to Timestamps (Start of start day, End of end day)
    const startTs = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
    const endTs = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

    const q = query(
      collection(db, 'inventory_transfers'),
      where('createdAt', '>=', startTs),
      where('createdAt', '<=', endTs),
      orderBy('createdAt', 'desc')
    );

    const unsubHistory = onSnapshot(q, (snapshot) => {
      setTransfersHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubHistory();
  }, [startDate, endDate]);

  // Filter products available in source store
  const availableProducts = sourceStoreId 
    ? products.filter(p => p.stock && p.stock[sourceStoreId] && p.stock[sourceStoreId].quantity > 0)
    : [];

  const handleQuantityChange = (productId: string, value: string, maxQty: number) => {
    let qty = parseInt(value) || 0;
    if (qty > maxQty) qty = maxQty;
    if (qty < 0) qty = 0;
    
    setTransferQuantities(prev => ({
      ...prev,
      [productId]: qty
    }));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

  const handleTransfer = async () => {
    if (!sourceStoreId || !destinationStoreId) {
      showToast("يرجى اختيار المخزن المرسل والمستقبل", "error");
      return;
    }
    if (sourceStoreId === destinationStoreId) {
      showToast("لا يمكن التحويل لنفس المخزن", "error");
      return;
    }

    const itemsToTransfer = availableProducts
      .filter(p => transferQuantities[p.id] > 0)
      .map(p => ({
        productId: p.id,
        name: p.name,
        qty: transferQuantities[p.id],
        unit: p.stock[sourceStoreId].unit
      }));

    if (itemsToTransfer.length === 0) {
      showToast("يرجى إدخال كميات صالحة للتحويل", "error");
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Create Transfer Receipt
      const transferRef = doc(collection(db, 'inventory_transfers'));
      batch.set(transferRef, {
        sourceStoreId,
        destinationStoreId,
        notes,
        items: itemsToTransfer,
        createdAt: serverTimestamp()
      });

      // 2. Update Product Stocks
      for (const item of itemsToTransfer) {
        const productRef = doc(db, 'products', item.productId);
        
        // Find the actual current product state from `products` array
        const currentProd = products.find(p => p.id === item.productId);
        if (!currentProd || !currentProd.stock) continue;

        const updatedStock = { ...currentProd.stock };

        // Deduct from source
        if (updatedStock[sourceStoreId]) {
          updatedStock[sourceStoreId].quantity -= item.qty;
        }

        // Add to destination
        if (updatedStock[destinationStoreId]) {
          updatedStock[destinationStoreId].quantity += item.qty;
        } else {
          updatedStock[destinationStoreId] = {
            quantity: item.qty,
            unit: item.unit
          };
        }

        batch.update(productRef, { stock: updatedStock });
      }

      await batch.commit();

      showToast("✅ تم التحويل بنجاح", "success");
      
      // Reset form
      setTransferQuantities({});
      setNotes('');
      setSourceStoreId('');
      setDestinationStoreId('');

    } catch (e) {
      console.error("Transfer error:", e);
      showToast("حدث خطأ أثناء عملية التحويل", "error");
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>تحويل مخزني شامل</h1>
      </header>

      <main className={styles.mainContent}>
        
        {/* Top Controls: Store Selection */}
        <div className={styles.topSection}>
          <div className={styles.formGroup}>
            <label>المخزن المُحوِّل منه (المصدر)</label>
            <select 
              value={sourceStoreId} 
              onChange={(e) => {
                setSourceStoreId(e.target.value);
                setTransferQuantities({});
              }}
              className={styles.selectInput}
            >
              <option value="">-- اختر المخزن --</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className={styles.transferIcon}>⇅</div>
          <div className={styles.formGroup}>
            <label>المخزن المُحوَّل إليه (الهدف)</label>
            <select 
              value={destinationStoreId} 
              onChange={(e) => setDestinationStoreId(e.target.value)}
              className={`${styles.selectInput} ${sourceStoreId && destinationStoreId && sourceStoreId === destinationStoreId ? styles.error : ''}`}
            >
              <option value="">-- اختر المخزن --</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {sourceStoreId && destinationStoreId && sourceStoreId === destinationStoreId && (
              <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.3rem', fontWeight: 'bold' }}>
                لايمكن التحويل الى نفس المخزن يرجى اختيار مخزن اخر
              </span>
            )}
          </div>
        </div>

        {/* Middle Section: Interactive Table */}
        <div className={styles.tableSection}>
          {sourceStoreId ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{width: '60px'}}>#</th>
                    <th>اسم الصنف</th>
                    <th>الكمية المتاحة (المصدر)</th>
                    <th>الوحدة</th>
                    <th style={{width: '200px'}}>الكمية المحولة</th>
                  </tr>
                </thead>
                <tbody>
                  {availableProducts.length > 0 ? (
                    availableProducts.map((p, idx) => {
                      const maxQty = p.stock[sourceStoreId].quantity;
                      const currentVal = transferQuantities[p.id] || '';
                      return (
                        <tr key={p.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                          <td>
                            <span className={styles.badge}>{maxQty}</span>
                          </td>
                          <td>{p.stock[sourceStoreId].unit}</td>
                          <td>
                            <input 
                              type="number" 
                              min="0"
                              max={maxQty}
                              className={styles.qtyInput}
                              value={currentVal}
                              onChange={(e) => handleQuantityChange(p.id, e.target.value, maxQty)}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                        لا توجد أصناف متاحة في هذا المخزن.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.placeholderBox}>
              يرجى اختيار المخزن المصدر لعرض البضاعة المتاحة للنقل.
            </div>
          )}
        </div>

        {/* Bottom Section: Notes & Submit */}
        <div className={styles.bottomSection}>
          <div className={styles.notesGroup}>
            <label>ملاحظات (اختياري)</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              className={styles.textareaInput}
              placeholder="اكتب أي ملاحظات متعلقة بعملية التحويل..."
            />
          </div>
          <button 
            className={styles.submitBtn} 
            onClick={handleTransfer}
            disabled={!sourceStoreId || !destinationStoreId}
          >
            تأكيد نقل البضاعة
          </button>
        </div>

        {/* History Section */}
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h2 className={styles.historyTitle}>سجل عمليات التحويل</h2>
            <div className={styles.dateFilterRow}>
              {/* Start Date Premium Picker */}
              <div className={styles.dateGroup}>
                <label>من تاريخ</label>
                <div 
                  className={styles.calendarTrigger}
                  onClick={() => setActiveCalendar('start')}
                >
                  <span className={styles.calendarIcon}>📅</span>
                  {startDate.split('-').reverse().join('/')}
                </div>
                {activeCalendar === 'start' && (
                  <CalendarPicker 
                    selectedDate={new Date(startDate)}
                    onSelect={(d) => setStartDate(d.toISOString().split('T')[0])}
                    onClose={() => setActiveCalendar(null)}
                  />
                )}
              </div>

              <div className={styles.dateGroup}>
                <label>إلى تاريخ</label>
                <div 
                  className={styles.calendarTrigger}
                  onClick={() => setActiveCalendar('end')}
                >
                  <span className={styles.calendarIcon}>📅</span>
                  {endDate.split('-').reverse().join('/')}
                </div>
                {activeCalendar === 'end' && (
                  <CalendarPicker 
                    selectedDate={new Date(endDate)}
                    onSelect={(d) => setEndDate(d.toISOString().split('T')[0])}
                    onClose={() => setActiveCalendar(null)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{width: '50px'}}>#</th>
                  <th>التاريخ والوقت</th>
                  <th>من مخزن</th>
                  <th>إلى مخزن</th>
                  <th>عدد الأصناف</th>
                  <th>ملاحظات</th>
                  <th style={{width: '90px', textAlign: 'center'}}>تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {transfersHistory.length > 0 ? (
                  transfersHistory.map((t, idx) => {
                    const sourceName = stores.find(s => s.id === t.sourceStoreId)?.name || 'غير معروف';
                    const targetName = stores.find(s => s.id === t.destinationStoreId)?.name || 'غير معروف';
                    const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('en-GB') : '...';
                    const isExpanded = expandedTransferId === t.id;
                    
                    return (
                      <React.Fragment key={t.id}>
                        <tr style={{ background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                          <td>{idx + 1}</td>
                          <td style={{ direction: 'ltr', textAlign: 'right' }}>{date}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{sourceName}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{targetName}</td>
                          <td>{t.items?.length || 0} صنف</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.notes || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => setExpandedTransferId(isExpanded ? null : t.id)}
                              style={{
                                background: isExpanded ? 'var(--bg-main)' : 'var(--surface-hover)', 
                                border: '1px solid var(--border)', color: 'var(--text-main)', 
                                padding: '0.4rem 0.7rem', borderRadius: '6px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem',
                                margin: '0 auto', transition: 'all 0.2s'
                              }}
                            >
                              👁️ {isExpanded ? 'اخفاء' : 'عرض'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && t.items && (
                          <tr>
                            <td colSpan={7} style={{ padding: '0 2rem 1.5rem 2rem', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '1rem', marginTop: '0.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                                <h4 style={{ color: '#a855f7', marginBottom: '0.8rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>📦</span> البضاعة المحولة في هذه العملية
                                </h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #374151', color: 'var(--text-muted)' }}>
                                      <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>اسم الصنف</th>
                                      <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>الكمية المُحوّلة</th>
                                      <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>وحدة القياس</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.items.map((item: any, i: number) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-main)' }}>{item.name}</td>
                                        <td style={{ padding: '0.6rem 1rem', color: '#10b981', fontWeight: 'bold' }}>{item.qty}</td>
                                        <td style={{ padding: '0.6rem 1rem', color: '#9ca3af' }}>{item.unit}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      لا توجد عمليات تحويل في هذه الفترة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast.type && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
