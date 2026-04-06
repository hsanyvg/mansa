"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  writeBatch,
  where,
  getDocs
} from 'firebase/firestore';

interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  category: string;
  openingBalance: number;
  currentDebt: number;
  createdAt: any;
}

interface Transaction {
  id: string;
  supplierId: string;
  date: any;
  type: 'opening_balance' | 'purchase' | 'payment' | 'return';
  amount: number;
  balanceAfter: number;
  notes: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    address: '',
    category: '',
    openingBalance: '0'
  });

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      setSuppliers(data);
    });
    return () => unsubscribe();
  }, []);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingId(supplier.id);
      setFormData({
        name: supplier.name,
        company: supplier.company || '',
        phone: supplier.phone,
        address: supplier.address || '',
        category: supplier.category || '',
        openingBalance: supplier.openingBalance?.toString() || '0'
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        company: '',
        phone: '',
        address: '',
        category: '',
        openingBalance: '0'
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      showToastMsg("الاسم ورقم الهاتف حقول إجبارية", "error");
      return;
    }

    try {
      const batch = writeBatch(db);
      const openBal = parseFloat(formData.openingBalance) || 0;

      if (editingId) {
        const supplierRef = doc(db, 'suppliers', editingId);
        // Note: Changing opening balance after creation might need careful transaction logic, 
        // but for now we just update the profile fields.
        batch.update(supplierRef, {
          name: formData.name,
          company: formData.company,
          phone: formData.phone,
          address: formData.address,
          category: formData.category
        });
        await batch.commit();
        showToastMsg("تم تحديث بيانات المورد بنجاح");
      } else {
        const supplierRef = doc(collection(db, 'suppliers'));
        batch.set(supplierRef, {
          name: formData.name,
          company: formData.company,
          phone: formData.phone,
          address: formData.address,
          category: formData.category,
          openingBalance: openBal,
          currentDebt: openBal,
          createdAt: serverTimestamp()
        });

        if (openBal !== 0) {
          const transRef = doc(collection(db, 'supplierTransactions'));
          batch.set(transRef, {
            supplierId: supplierRef.id,
            date: serverTimestamp(),
            type: 'opening_balance',
            amount: openBal,
            balanceAfter: openBal,
            notes: 'الرصيد الافتتاحي عند التأسيس'
          });
        }
        await batch.commit();
        showToastMsg("تم إضافة المورد بنجاح");
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving supplier:", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleOpenStatement = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingStatement(true);
    setShowStatement(true);
    try {
      const q = query(
        collection(db, 'supplierTransactions'), 
        where('supplierId', '==', supplier.id)
      );
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
      
      // Client-side sort by date
      data.sort((a, b) => {
        const timeA = a.date?.toMillis() || 0;
        const timeB = b.date?.toMillis() || 0;
        return timeA - timeB;
      });

      setTransactions(data);
    } catch (err) {
      console.error("Error fetching statement:", err);
    } finally {
      setLoadingStatement(false);
    }
  };

  const getWhatsappLink = (phone: string) => {
    let cleanPhone = phone.trim();
    if (cleanPhone.startsWith('0')) cleanPhone = '964' + cleanPhone.substring(1);
    cleanPhone = cleanPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val) + ' د.ع';
  };

  return (
    <div className={styles.container}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}

      <header className={styles.header}>
        <h1 className={styles.title}>قائمة الموردين</h1>
        <button className={styles.addButton} onClick={() => handleOpenModal()}>
          <span>+ إضافة مورد جديد</span>
        </button>
      </header>

      <section className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input 
            type="text" 
            placeholder="بحث باسم المورد أو الهاتف..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>
      </section>

      <main className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>المورد</th>
              <th>رقم الهاتف</th>
              <th>نوع البضاعة</th>
              <th>إجمالي الدين</th>
              <th>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td className={styles.supplierName} onClick={() => handleOpenStatement(supplier)}>
                  {supplier.name}
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{supplier.company}</div>
                </td>
                <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {supplier.phone}
                        <a href={getWhatsappLink(supplier.phone)} target="_blank" className={styles.whatsappBtn} style={{ padding: '4px 8px', background: '#25D366' }}>💬</a>
                    </div>
                </td>
                <td>{supplier.category || '---'}</td>
                <td className={`${styles.debtValue} ${supplier.currentDebt === 0 ? styles.zero : ''}`}>
                  {formatCurrency(supplier.currentDebt || 0)}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => handleOpenModal(supplier)}>✏️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingId ? 'تعديل مودر' : 'إضافة مورد جديد'}</h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الاسم الكامل *</label>
                    <input type="text" className={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الشركة / المعرض</label>
                    <input type="text" className={styles.input} value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>رقم الهاتف *</label>
                    <input type="text" className={styles.input} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>تصنيف البضاعة</label>
                    <input type="text" className={styles.input} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="مثال: اكسسوارات، هواتف..." />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>العنوان</label>
                    <input type="text" className={styles.input} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الرصيد الافتتاحي (دين لك عليه)</label>
                    <input type="number" className={styles.input} value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: e.target.value})} disabled={!!editingId} />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowModal(false)}>إلغاء</button>
                <button type="submit" className={styles.saveButton}>حفظ البيانات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement Modal */}
      {showStatement && selectedSupplier && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>كشف حساب: {selectedSupplier.name}</h2>
              <button className={styles.closeButton} onClick={() => setShowStatement(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.statementSummary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>إجمالي الدين الحالي</span>
                  <span className={`${styles.summaryValue} ${styles.debit}`}>{formatCurrency(selectedSupplier.currentDebt)}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>شركة</span>
                  <span className={styles.summaryValue}>{selectedSupplier.company || '---'}</span>
                </div>
                <div className={styles.summaryItem}>
                    <a href={getWhatsappLink(selectedSupplier.phone)} target="_blank" className={styles.whatsappBtn}>
                        <span>💬 مراسلة عبر واتساب</span>
                    </a>
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>نوع العملية</th>
                      <th>البيان / ملاحظات</th>
                      <th>المبلغ</th>
                      <th>الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStatement ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>جاري تحميل كشف الحساب...</td></tr>
                    ) : transactions.length > 0 ? (
                      transactions.map((tr) => (
                        <tr key={tr.id}>
                          <td>{tr.date?.toDate().toLocaleDateString('ar-EG')}</td>
                          <td>
                            {tr.type === 'opening_balance' && 'رصيد افتتاحي'}
                            {tr.type === 'purchase' && 'فاتورة مشتريات'}
                            {tr.type === 'payment' && 'سند صرف'}
                            {tr.type === 'return' && 'مرتجع مشتريات'}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{tr.notes}</td>
                          <td className={tr.type === 'payment' || tr.type === 'return' ? styles.credit : styles.debit}>
                             {tr.type === 'payment' || tr.type === 'return' ? '-' : '+'}{formatCurrency(tr.amount)}
                          </td>
                          <td className={styles.runningBalance}>{formatCurrency(tr.balanceAfter)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>لا توجد عمليات مسجلة لهذا المورد</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.modalFooter}>
               <button className={styles.cancelButton} onClick={() => window.print()}>🖨️ طباعة الكشف</button>
               <button className={styles.saveButton} onClick={() => setShowStatement(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
