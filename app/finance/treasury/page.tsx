"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, getDocs, getDoc, writeBatch, where, updateDoc,
  increment, arrayUnion
} from 'firebase/firestore';

// Types
interface Wallet {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  walletId?: string;
  fromWalletId?: string;
  toWalletId?: string;
  amount: number;
  currency: 'IQD' | 'USD';
  date: string;
  time: string;
  details: string;
  createdAt: any;
  externalStatementId?: string;
  deliveryAgent?: string;
  notes?: string;
  images?: string[];
  settledOrderIds?: string[];
  resolvedDiscrepancyOrderIds?: string[];
  hasSubsequentModifications?: boolean;
}


export default function TreasuryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'transfer' | 'adjust' | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drill-down states
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [settledOrders, setSettledOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [modalOrderIdSearch, setModalOrderIdSearch] = useState('');
  const [modalPhoneSearch, setModalPhoneSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [discrepantOrders, setDiscrepantOrders] = useState<any[]>([]);
  const [showDiscrepanciesModal, setShowDiscrepanciesModal] = useState(false);
  const [resolvingOrderId, setResolvingOrderId] = useState<string | null>(null);
  const [editingCustomAmountId, setEditingCustomAmountId] = useState<string | null>(null);
  const [customAmountValue, setCustomAmountValue] = useState<string>('');

  const handleViewTransactionDetails = async (t: Transaction) => {
    setSelectedTransaction(t);
    setDiscrepantOrders([]);
    
    // Fetch discrepant orders linked to this transaction
    try {
      const discrepantQuery = query(
        collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'),
        where('discrepancy_statement_id', '==', t.id)
      );
      const discrepantSnap = await getDocs(discrepantQuery);
      const discrepantList = discrepantSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDiscrepantOrders(discrepantList);
    } catch (err) {
      console.error("Error fetching discrepant orders:", err);
    }

    if (t.settledOrderIds && t.settledOrderIds.length > 0) {
      setLoadingOrders(true);
      setSettledOrders([]);
      try {
        const promises = t.settledOrderIds.map(async (id) => {
          const docSnap = await getDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            let addDate = '---';
            let addTime = '---';
            if (data.date) {
              const dateObj = data.date.toDate ? data.date.toDate() : new Date(data.date);
              addDate = dateObj.toLocaleDateString('en-GB');
              addTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
            }
            return { id: docSnap.id, ...data, addDate, addTime };
          }
          return null;
        });
        const results = await Promise.all(promises);
        setSettledOrders(results.filter(Boolean));
      } catch (err) {
        console.error("Error fetching settled orders:", err);
      } finally {
        setLoadingOrders(false);
      }
    }
  };

  const handleAcceptPartialAmount = async (order: any) => {
    if (!selectedTransaction) return;
    setResolvingOrderId(order.id);
    try {
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id);
      
      const inputtedAmount = order.discrepancy_inputted_amount || 0;
      
      const batch = writeBatch(db);
      
      const newPaidAmount = (order.paidAmount || 0) + inputtedAmount;
      const isFullySettled = newPaidAmount >= (order.totalAmount || 0);

      batch.update(orderRef, {
        paidAmount: newPaidAmount,
        has_discrepancy: false,
        discrepancy_note: null,
        discrepancy_statement_id: null,
        discrepancy_inputted_amount: null,
        discrepancy_expected_amount: null,
        paymentStatus: isFullySettled ? 'settled' : 'partially_settled',
        settledWalletId: selectedTransaction.walletId,
        settledAt: serverTimestamp(),
        settlementStatementId: selectedTransaction.externalStatementId || selectedTransaction.id
      });

      // Add money to treasury by modifying existing transaction
      const transactionRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions', selectedTransaction.id);
      batch.update(transactionRef, {
        amount: increment(inputtedAmount),
        settledOrderIds: arrayUnion(order.id),
        resolvedDiscrepancyOrderIds: arrayUnion(order.id),
        hasSubsequentModifications: true
      });
      
      await batch.commit();
      
      // Update UI
      setDiscrepantOrders(prev => prev.filter(o => o.id !== order.id));
      setToast({ message: 'تم تسوية الطلب بالمبلغ الناقص بنجاح.', type: 'success' });
      if (discrepantOrders.length === 1) {
        setShowDiscrepanciesModal(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'حدث خطأ أثناء المعالجة.', type: 'error' });
    } finally {
      setResolvingOrderId(null);
    }
  };

  const handleAcceptCustomAmount = async (order: any) => {
    if (!selectedTransaction) return;
    const customAmount = Number(customAmountValue);
    if (isNaN(customAmount) || customAmount <= 0) {
      setToast({ message: 'يرجى إدخال مبلغ صحيح.', type: 'error' });
      return;
    }
    
    setResolvingOrderId(order.id);
    try {
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id);
      
      const batch = writeBatch(db);
      
      const newPaidAmount = (order.paidAmount || 0) + customAmount;
      const isFullySettled = newPaidAmount >= (order.totalAmount || 0);

      batch.update(orderRef, {
        paidAmount: newPaidAmount,
        has_discrepancy: false,
        discrepancy_note: null,
        discrepancy_statement_id: null,
        discrepancy_inputted_amount: null,
        discrepancy_expected_amount: null,
        paymentStatus: isFullySettled ? 'settled' : 'partially_settled',
        settledWalletId: selectedTransaction.walletId,
        settledAt: serverTimestamp(),
        settlementStatementId: selectedTransaction.externalStatementId || selectedTransaction.id
      });

      // Add money to treasury by modifying existing transaction
      const transactionRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions', selectedTransaction.id);
      batch.update(transactionRef, {
        amount: increment(customAmount),
        settledOrderIds: arrayUnion(order.id),
        resolvedDiscrepancyOrderIds: arrayUnion(order.id),
        hasSubsequentModifications: true
      });
      
      await batch.commit();
      
      // Update UI
      setDiscrepantOrders(prev => prev.filter(o => o.id !== order.id));
      setToast({ message: 'تم تسوية الطلب بالمبلغ المخصص بنجاح.', type: 'success' });
      setEditingCustomAmountId(null);
      setCustomAmountValue('');
      
      if (discrepantOrders.length === 1) {
        setShowDiscrepanciesModal(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'حدث خطأ أثناء المعالجة.', type: 'error' });
    } finally {
      setResolvingOrderId(null);
    }
  };

  const handleClearDiscrepancyFlag = async (order: any) => {
    setResolvingOrderId(order.id);
    try {
      const orderRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', order.id);
      await updateDoc(orderRef, {
        has_discrepancy: false,
        discrepancy_note: null,
        discrepancy_statement_id: null,
        discrepancy_inputted_amount: null,
        discrepancy_expected_amount: null
      });
      setDiscrepantOrders(prev => prev.filter(o => o.id !== order.id));
      setToast({ message: 'تم إعادة الطلب لقيد الانتظار بنجاح.', type: 'success' });
      if (discrepantOrders.length === 1) {
        setShowDiscrepanciesModal(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'حدث خطأ أثناء المعالجة.', type: 'error' });
    } finally {
      setResolvingOrderId(null);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    walletId: '',
    fromWalletId: '',
    toWalletId: '',
    amount: '',
    currency: 'IQD' as 'IQD' | 'USD',
    date: new Date().toISOString().split('T')[0],
    details: ''
  });

  useEffect(() => {
    setIsMounted(true);
    setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Listen to Wallets
    const unsubWallets = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), (snapshot) => {
      setWallets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
    });

    // Listen to Transactions
    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'), orderBy('createdAt', 'desc'));
    const unsubTrans = onSnapshot(q, (snapshot) => {
      const fetchedTrans = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      // Sort by date descending (newest dates first) to replace Firebase compound sorting
      fetchedTrans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(fetchedTrans);
      setLoading(false);
    });

    return () => {
      unsubWallets();
      unsubTrans();
    };
  }, [isMounted]);

  const showToastMsg = (m: string, t: 'success' | 'error' = 'success') => {
    setToast({ message: m, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (type: 'deposit' | 'withdraw' | 'transfer' | 'adjust') => {
    setFormData({
      walletId: '',
      fromWalletId: '',
      toWalletId: '',
      amount: '',
      currency: 'IQD',
      date: new Date().toISOString().split('T')[0],
      details: ''
    });
    setActiveModal(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.date || !formData.details) {
      return showToastMsg("يرجى ملء جميع الحقول الإجبارية", "error");
    }

    const numAmount = Number(formData.amount);

    if (activeModal === 'adjust') {
      if (!formData.walletId) return showToastMsg("يرجى تحديد المحفظة", "error");
      const currentBalance = getWalletBalance(formData.walletId, formData.currency as 'IQD' | 'USD');
      const difference = numAmount - currentBalance;
      
      if (difference === 0) {
        return showToastMsg("الرصيد الفعلي مطابق للرصيد المسجل، لا داعي للتسوية", "error");
      }
      
      const type = difference > 0 ? 'deposit' : 'withdraw';
      const absDiff = Math.abs(difference);
      const detailsPrefix = difference > 0 ? 'تسوية جرد (فائض) - ' : 'تسوية جرد (نقص) - ';

      const now = new Date();
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const data: any = {
        type: type,
        amount: absDiff,
        currency: formData.currency,
        date: formData.date,
        time: time,
        details: detailsPrefix + formData.details,
        createdAt: serverTimestamp(),
        walletId: formData.walletId
      };

      try {
        await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'), data);
        showToastMsg("تمت تسوية الرصيد بنجاح");
        setActiveModal(null);
      } catch (err) {
        showToastMsg("حدث خطأ أثناء الحفظ", "error");
      }
      return;
    }

    if (activeModal === 'transfer') {
      if (!formData.fromWalletId || !formData.toWalletId) return showToastMsg("يرجى تحديد المحفظتين", "error");
      if (formData.fromWalletId === formData.toWalletId) return showToastMsg("لا يمكن التحويل لنفس المحفظة", "error");
      
      const currentBalance = getWalletBalance(formData.fromWalletId, formData.currency as 'IQD' | 'USD');
      if (numAmount > currentBalance) {
        return showToastMsg("عذراً، الرصيد المتوفر في هذه المحفظة غير كافٍ لإتمام العملية", "error");
      }
    } else if (activeModal === 'withdraw') {
      if (!formData.walletId) return showToastMsg("يرجى تحديد المحفظة", "error");
      
      const currentBalance = getWalletBalance(formData.walletId, formData.currency as 'IQD' | 'USD');
      if (numAmount > currentBalance) {
        return showToastMsg("عذراً، الرصيد المتوفر في هذه المحفظة غير كافٍ لإتمام العملية", "error");
      }
    } else {
      if (!formData.walletId) return showToastMsg("يرجى تحديد المحفظة", "error");
    }

    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const data: any = {
      type: activeModal,
      amount: Number(formData.amount),
      currency: formData.currency,
      date: formData.date,
      time: time,
      details: formData.details,
      createdAt: serverTimestamp()
    };

    if (activeModal === 'transfer') {
      data.fromWalletId = formData.fromWalletId;
      data.toWalletId = formData.toWalletId;
    } else {
      data.walletId = formData.walletId;
    }

    try {
      await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'), data);
      showToastMsg("تمت العملية بنجاح");
      setActiveModal(null);
    } catch (err) {
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleRevertTransactionClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    const transaction = transactions.find(t => t.id === id);
    setDeleteConfirmId(null);
    
    try {
      const batch = writeBatch(db);
      
      // Delete the transaction itself
      batch.delete(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions', id));
      
      // If this transaction was a settlement, revert all associated orders to unsettled
      if (transaction && transaction.settledOrderIds && transaction.settledOrderIds.length > 0) {
        transaction.settledOrderIds.forEach(orderId => {
          batch.update(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders', orderId), {
            is_settled: false,
            paymentStatus: '',
            settlementStatementId: '',
            isSettlementArchived: false,
            paidAmount: 0
          });
        });
      }
      
      await batch.commit();
      showToastMsg("تم إلغاء الحركة وتحديث الأرصدة والطلبات بنجاح");
    } catch (err) {
      console.error(err);
      showToastMsg("حدث خطأ أثناء الإلغاء", "error");
    }
  };

  // Calculations
  const getWalletBalance = (walletId: string, currency: 'IQD' | 'USD') => {
    return transactions.reduce((total, t) => {
      if (t.currency !== currency) return total;
      
      if (t.type === 'deposit' && t.walletId === walletId) return total + t.amount;
      if (t.type === 'withdraw' && t.walletId === walletId) return total - t.amount;
      if (t.type === 'transfer') {
        if (t.fromWalletId === walletId) return total - t.amount;
        if (t.toWalletId === walletId) return total + t.amount;
      }
      return total;
    }, 0);
  };

  const getTotalBalance = (currency: 'IQD' | 'USD') => {
    return transactions.reduce((total, t) => {
      if (t.currency !== currency) return total;
      if (t.type === 'deposit') return total + t.amount;
      if (t.type === 'withdraw') return total - t.amount;
      // transfers don't change total
      return total;
    }, 0);
  };

  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase();
    const walletName = wallets.find(w => w.id === t.walletId)?.name || '';
    const fromWalletName = wallets.find(w => w.id === t.fromWalletId)?.name || '';
    const toWalletName = wallets.find(w => w.id === t.toWalletId)?.name || '';
    
    return (
      (t.details || '').toLowerCase().includes(q) ||
      walletName.toLowerCase().includes(q) ||
      fromWalletName.toLowerCase().includes(q) ||
      toWalletName.toLowerCase().includes(q) ||
      t.amount.toString().includes(q) ||
      t.date.includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    );
  });

  if (!isMounted) return null;

  return (
    <div className={styles.container}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}

      <header className={styles.header}>
        <h1 className={styles.title}>خزينة المنصة (إدارة المحافظ)</h1>
      </header>

      {/* Balance Grid */}
      <div className={styles.balanceGrid}>
        <div className={`${styles.balanceCard} ${styles.totalCard}`}>
          <span className={styles.cardIcon}>💎</span>
          <div className={styles.cardLabel}>إجمالي الرصيد الكلي</div>
          <div className={styles.cardValue}>
            <div className={styles.iqdValue}>{getTotalBalance('IQD').toLocaleString()} د.ع</div>
            <div className={styles.usdValue}>{getTotalBalance('USD').toLocaleString()} $</div>
          </div>
        </div>

        {wallets.map(wallet => (
          <div key={wallet.id} className={styles.balanceCard}>
            <span className={styles.cardIcon}>🏦</span>
            <div className={styles.cardLabel}>{wallet.name}</div>
            <div className={styles.cardValue}>
              <div className={styles.iqdValue}>{getWalletBalance(wallet.id, 'IQD').toLocaleString()} د.ع</div>
              <div className={styles.usdValue}>{getWalletBalance(wallet.id, 'USD').toLocaleString()} $</div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Toolbar */}
      <div className={styles.toolbar}>
        <button className={`${styles.actionBtn} ${styles.depositBtn}`} onClick={() => handleOpenModal('deposit')}>
          ➕ إيداع نقدي
        </button>
        <button className={`${styles.actionBtn} ${styles.withdrawBtn}`} onClick={() => handleOpenModal('withdraw')}>
          ➖ سحب نقدي
        </button>
        <button className={`${styles.actionBtn} ${styles.transferBtn}`} onClick={() => handleOpenModal('transfer')}>
          🔄 تحويل داخلي
        </button>
        <button className={`${styles.actionBtn}`} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} onClick={() => handleOpenModal('adjust')}>
          ⚙️ تسوية الرصيد
        </button>
      </div>

      {/* Ledger Table */}
      <section className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>سجل الحركات المالية</h2>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="بحث في البيان، المحفظة، أو المبلغ..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>نوع الحركة</th>
                <th>المحفظة</th>
                <th>البيان</th>
                <th>المبلغ</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => (
                <tr key={t.id}>
                  <td>
                    {t.date}
                    <span className={styles.timeText}>🕒 {t.time}</span>
                  </td>
                  <td>
                    <span className={`${styles.typeTag} ${
                      t.type === 'deposit' ? styles.depositTag : 
                      t.type === 'withdraw' ? styles.withdrawTag : styles.transferTag
                    }`}>
                      {t.type === 'deposit' ? 'إيداع' : t.type === 'withdraw' ? 'سحب' : 'تحويل'}
                    </span>
                  </td>
                  <td>
                    {t.type === 'transfer' ? (
                      <div>
                        <span className={styles.walletTag}>{wallets.find(w => w.id === t.fromWalletId)?.name}</span>
                        <span style={{margin: '0 5px'}}>⬅️</span>
                        <span className={styles.walletTag}>{wallets.find(w => w.id === t.toWalletId)?.name}</span>
                      </div>
                    ) : (
                      <span className={styles.walletTag}>{wallets.find(w => w.id === t.walletId)?.name}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: t.settledOrderIds && t.settledOrderIds.length > 0 && !t.details?.includes('تسوية') ? '#38bdf8' : 'inherit' }}>
                      {t.details?.startsWith('تسوية تلقائية للطلبات ذات الأرقام') ? (
                        `🧾 تسوية كشف تلقائية (${t.settledOrderIds?.length || 'مجموعة'} طلبات)`
                      ) : t.settledOrderIds && t.settledOrderIds.length > 0 && !t.details?.includes('تسوية يدوية') && !t.details?.includes('تسوية مبلغ') && !t.details?.includes('تسوية تلقائية') ? (
                        `🧾 تسوية كشف تلقائية (${t.settledOrderIds.length} طلبات)`
                      ) : (
                        t.details
                      )}
                    </div>
                    {t.hasSubsequentModifications && (
                       <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '4px' }}>⚠️ تم التعديل لاحقاً (معالجة نواقص)</div>
                    )}
                    {t.notes && t.settledOrderIds && t.settledOrderIds.length > 0 && (
                      <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '2px' }}>{t.notes}</div>
                    )}
                    {(t.externalStatementId || t.deliveryAgent) && (
                      <div style={{
                        marginTop: '6px',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}>
                        {t.externalStatementId && (
                          <span style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(56, 189, 248, 0.2)'
                          }}>
                            📄 كشف: {t.externalStatementId}
                          </span>
                        )}
                        {t.deliveryAgent && (
                          <span style={{
                            backgroundColor: 'rgba(241, 245, 249, 0.05)',
                            color: '#e2e8f0',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                          }}>
                            👤 المندوب: {t.deliveryAgent}
                          </span>
                        )}
                        {t.images && t.images.length > 0 && (
                          <span style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            fontWeight: '600'
                          }}>
                            📸 {t.images.length} مرفقات
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={styles.amountCell}>
                    <span className={t.type === 'deposit' ? styles.amountDeposit : t.type === 'withdraw' ? styles.amountWithdraw : styles.amountTransfer}>
                      {t.type === 'withdraw' ? '-' : t.type === 'deposit' ? '+' : ''}
                      {t.amount.toLocaleString()} {t.currency === 'IQD' ? 'د.ع' : '$'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleViewTransactionDetails(t)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '4px'
                        }}
                        title="عرض التفاصيل"
                      >
                        👁️
                      </button>
                      <button 
                        className={styles.revertBtn} 
                        onClick={() => handleRevertTransactionClick(t.id)}
                        title="إلغاء الحركة"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📭</span>
              <p>لا توجد حركات مالية مسجلة</p>
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {activeModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {activeModal === 'deposit' ? 'إيداع نقدي جديد' : 
               activeModal === 'withdraw' ? 'سحب نقدي جديد' : 
               activeModal === 'adjust' ? 'تسوية الرصيد' : 'تحويل داخلي بين المحافظ'}
            </h2>
            <form onSubmit={handleSubmit}>
              {activeModal === 'transfer' ? (
                <div style={{display: 'flex', gap: '1rem'}}>
                  <div className={styles.formGroup} style={{flex: 1}}>
                    <label className={styles.label}>من محفظة</label>
                    <select 
                      className={styles.select} 
                      value={formData.fromWalletId} 
                      onChange={e => setFormData({...formData, fromWalletId: e.target.value})}
                      required
                    >
                      <option value="">اختر...</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup} style={{flex: 1}}>
                    <label className={styles.label}>إلى محفظة</label>
                    <select 
                      className={styles.select} 
                      value={formData.toWalletId} 
                      onChange={e => setFormData({...formData, toWalletId: e.target.value})}
                      required
                    >
                      <option value="">اختر...</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label className={styles.label}>المحفظة</label>
                  <select 
                    className={styles.select} 
                    value={formData.walletId} 
                    onChange={e => setFormData({...formData, walletId: e.target.value})}
                    required
                  >
                    <option value="">اختر المحفظة...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{display: 'flex', gap: '1rem'}}>
                <div className={styles.formGroup} style={{flex: 2}}>
                  <label className={styles.label}>{activeModal === 'adjust' ? 'الرصيد الفعلي (الموجود حالياً)' : 'المبلغ'}</label>
                  <input 
                    type="number" 
                    className={styles.input} 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className={styles.formGroup} style={{flex: 1}}>
                  <label className={styles.label}>العملة</label>
                  <select 
                    className={styles.select} 
                    value={formData.currency} 
                    onChange={e => setFormData({...formData, currency: e.target.value as 'IQD' | 'USD'})}
                  >
                    <option value="IQD">د.ع</option>
                    <option value="USD">$</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>التاريخ</label>
                <input 
                  type="date" 
                  className={`${styles.input} ${formData.date !== new Date().toISOString().split('T')[0] ? styles.notToday : ''}`}
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  required
                />
                {formData.date !== new Date().toISOString().split('T')[0] && <span className={styles.dateWarning}>⚠️ انتبه! ليس تاريخ اليوم</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>البيان / السبب</label>
                <textarea 
                  className={styles.textarea} 
                  value={formData.details} 
                  onChange={e => setFormData({...formData, details: e.target.value})}
                  placeholder="اكتب تفاصيل العملية هنا..."
                  rows={3}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitBtn}>تأكيد العملية</button>
                <button type="button" className={styles.cancelBtn} onClick={() => setActiveModal(null)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle} style={{ color: '#ef4444' }}>تأكيد إلغاء الحركة</h2>
            <p style={{ margin: '1.5rem 0', color: 'var(--text-color)', fontSize: '1.1rem', lineHeight: '1.6', textAlign: 'center' }}>
              هل أنت متأكد من إلغاء هذه الحركة؟<br/>سيتم إرجاع الأرصدة إلى وضعها السابق.
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.submitBtn} 
                style={{ backgroundColor: '#ef4444' }} 
                onClick={confirmDeleteTransaction}
              >
                نعم، تأكيد الإلغاء
              </button>
              <button className={styles.cancelBtn} onClick={() => setDeleteConfirmId(null)}>
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTransaction(null)}>
          <div className={styles.detailsModal} style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #111827 100%)' }}>
              <h2>
                🧾 تفاصيل الحركة المالية 
                <span style={{ color: '#38bdf8', fontSize: '1rem', marginRight: '0.5rem' }}>
                  {selectedTransaction.type === 'deposit' ? 'إيداع' : selectedTransaction.type === 'withdraw' ? 'سحب' : 'تحويل'}
                </span>
              </h2>
              <button className={styles.closeButton} onClick={() => setSelectedTransaction(null)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              {selectedTransaction.hasSubsequentModifications && (
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                    <strong>ملاحظة:</strong> تم تعديل مبلغ هذه الحركة لاحقاً بعد إنشائها (بسبب معالجة نواقص وتسويات إضافية).
                  </p>
                </div>
              )}
              {/* Transaction Information Grid */}
              <div className={styles.detailsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>رقم الحركة</span>
                  <span className={styles.detailsValue}>{selectedTransaction.id}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>نوع العملية</span>
                  <span className={styles.detailsValue} style={{ color: selectedTransaction.type === 'deposit' ? '#10b981' : selectedTransaction.type === 'withdraw' ? '#ef4444' : '#a855f7' }}>
                    {selectedTransaction.type === 'deposit' ? 'إيداع' : selectedTransaction.type === 'withdraw' ? 'سحب' : 'تحويل'}
                  </span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المحفظة</span>
                  <span className={styles.detailsValue}>
                    {selectedTransaction.type === 'transfer' ? (
                      `${wallets.find(w => w.id === selectedTransaction.fromWalletId)?.name || 'غير معروفة'} ➡️ ${wallets.find(w => w.id === selectedTransaction.toWalletId)?.name || 'غير معروفة'}`
                    ) : (
                      wallets.find(w => w.id === selectedTransaction.walletId)?.name || 'غير معروفة'
                    )}
                  </span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>التاريخ والوقت</span>
                  <span className={styles.detailsValue}>{selectedTransaction.date} - {selectedTransaction.time}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المبلغ الكلي</span>
                  <span className={styles.detailsValue} style={{ color: selectedTransaction.type === 'deposit' ? '#10b981' : '#fff', fontWeight: 'bold' }}>
                    {selectedTransaction.amount.toLocaleString()} {selectedTransaction.currency === 'IQD' ? 'د.ع' : '$'}
                  </span>
                </div>
                {selectedTransaction.externalStatementId && (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>رقم كشف الشركة / الورقي</span>
                    <span className={styles.detailsValue} style={{ color: '#38bdf8' }}>📄 {selectedTransaction.externalStatementId}</span>
                  </div>
                )}
                {selectedTransaction.deliveryAgent && (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>المندوب المسلِّم</span>
                    <span className={styles.detailsValue}>👤 {selectedTransaction.deliveryAgent}</span>
                  </div>
                )}
              </div>

              {/* Discrepancies Alert */}
              {discrepantOrders.length > 0 && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', color: '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🚨</span> هناك طلبات لم تتم المحاسبة عليها
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                      يوجد {discrepantOrders.length} طلبات ضمن هذا الكشف كان بها اختلاف في المبالغ ولم يتم تسويتها.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDiscrepanciesModal(true)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    حل المشاكل
                  </button>
                </div>
              )}

              {/* Orders List Table inside Transaction */}
              {selectedTransaction.settledOrderIds && selectedTransaction.settledOrderIds.length > 0 && (
                <div className={styles.itemsTableContainer} style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.8rem', fontWeight: '600' }}>📦 الطلبات المستلمة والمشمولة في هذه التسوية:</h3>
                  {loadingOrders ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#cbd5e1' }}>
                      <span className={styles.loaderSmall} style={{ borderTopColor: '#38bdf8', width: '20px', height: '20px', marginLeft: '8px' }}></span>
                      جاري تحميل بيانات الطلبات من قاعدة البيانات...
                    </div>
                  ) : (
                    <table className={styles.itemsTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              رقم الطلب
                              <input 
                                type="text" 
                                placeholder="بحث..." 
                                value={modalOrderIdSearch}
                                onChange={e => setModalOrderIdSearch(e.target.value)}
                                style={{ width: '100%', padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                              />
                            </div>
                          </th>
                          <th>اسم الزبون</th>
                          <th>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              رقم الهاتف
                              <input 
                                type="text" 
                                placeholder="بحث..." 
                                value={modalPhoneSearch}
                                onChange={e => setModalPhoneSearch(e.target.value)}
                                style={{ width: '100%', padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                              />
                            </div>
                          </th>
                          <th>المحافظة والمنطقة</th>
                          <th>المبلغ</th>
                          <th style={{ width: '60px', textAlign: 'center' }}>التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filteredSettledOrders = settledOrders.filter(order => {
                            const matchId = !modalOrderIdSearch || String(order.id).toLowerCase().includes(modalOrderIdSearch.toLowerCase());
                            const matchPhone = !modalPhoneSearch || String(order.customerPhone || order.phone || '').toLowerCase().includes(modalPhoneSearch.toLowerCase());
                            return matchId && matchPhone;
                          });
                          return filteredSettledOrders.length > 0 ? (
                            filteredSettledOrders.map((order, idx) => {
                              const isResolvedLater = selectedTransaction.resolvedDiscrepancyOrderIds?.includes(order.id);
                              return (
                              <tr key={order.id} style={{ backgroundColor: isResolvedLater ? 'rgba(245, 158, 11, 0.15)' : 'transparent' }}>
                                <td>{idx + 1} {isResolvedLater && <span title="تم التعديل عليه ومعالجته لاحقاً" style={{ cursor: 'help', fontSize: '0.9em', marginRight: '4px' }}>⚠️</span>}</td>
                                <td style={{ fontWeight: 'bold' }}>{order.id}</td>
                              <td>{order.customerName}</td>
                              <td style={{ direction: 'ltr', textAlign: 'right' }}>{order.customerPhone || '---'}</td>
                              <td>{order.governorate} - {order.region}</td>
                              <td style={{ color: '#10b981', fontWeight: 'bold' }}>{order.totalAmount.toLocaleString()} د.ع</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(order)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    padding: '4px'
                                  }}
                                  title="عرض تفاصيل الطلب والمواد"
                                >
                                  👁️
                                </button>
                              </td>
                            </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>
                              لا يوجد نتائج مطابقة للبحث أو تعذر التحميل.
                            </td>
                          </tr>
                        );
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Transaction Notes */}
              {(selectedTransaction.notes || selectedTransaction.details) && (
                <div className={styles.settlementDetailsSection} style={{ marginBottom: '1.5rem' }}>
                  <h3 className={styles.sectionSubTitle}>📝 البيان / الملاحظات</h3>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {selectedTransaction.settledOrderIds && selectedTransaction.settledOrderIds.length > 0 ? (
                      selectedTransaction.notes || selectedTransaction.details
                    ) : (
                      selectedTransaction.details
                    )}
                  </div>
                </div>
              )}

              {/* Attachment Images */}
              {selectedTransaction.images && selectedTransaction.images.length > 0 && (
                <div className={styles.settlementDetailsSection}>
                  <h3 className={styles.sectionSubTitle}>🖼️ مرفقات وصور الحركة ({selectedTransaction.images.length})</h3>
                  <div className={styles.imageGallery}>
                    {selectedTransaction.images.map((imgUrl, index) => {
                      const urlStr = imgUrl ? decodeURIComponent(imgUrl.split('?')[0]) : '';
                      const isImage = imgUrl && (imgUrl.startsWith('data:image/') || urlStr.match(/\.(jpeg|jpg|gif|png|webp)$/i));
                      if (isImage) {
                        return (
                          <div 
                            key={index} 
                            className={styles.galleryImageCard}
                            onClick={() => setLightboxImage(imgUrl)}
                          >
                            <img src={imgUrl} alt={`مرفق حركة ${index + 1}`} className={styles.galleryImage} />
                            <div className={styles.galleryImageOverlay}>
                              <span>🔍 تكبير</span>
                            </div>
                          </div>
                        );
                      } else {
                        let ext = 'ملف';
                        if (urlStr.match(/\.(xlsx|xls|csv)$/i) || imgUrl.includes('spreadsheet') || imgUrl.includes('excel')) ext = 'EXCEL';
                        else if (urlStr.match(/\.pdf$/i) || imgUrl.includes('pdf')) ext = 'PDF';
                        else if (urlStr.match(/\.(doc|docx)$/i) || imgUrl.includes('word')) ext = 'WORD';
                        
                        return (
                          <a 
                            key={index}
                            href={imgUrl} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`document_${index + 1}.${ext.toLowerCase()}`}
                            className={styles.galleryImageCard}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                              color: '#60a5fa',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px dashed rgba(255,255,255,0.1)'
                            }}
                          >
                            <span style={{ fontSize: '2rem' }}>📄</span>
                            <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center', padding: '0 4px' }}>
                              تحميل ({ext})
                            </span>
                          </a>
                        );
                      }
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooterDetails}>
              <div className={styles.notesSection}>
                {selectedTransaction.settledOrderIds && selectedTransaction.settledOrderIds.length > 0 ? (
                  "💡 اضغط على زر العين (👁️) بجانب أي طلب في الجدول أعلاه لعرض الأصناف المشتраة وتفاصيل العميل."
                ) : (
                  "حركة مالية مسجلة في سجل الخزينة."
                )}
              </div>
              <div className={styles.totalHighlight} style={{ color: selectedTransaction.type === 'deposit' ? '#10b981' : '#fff' }}>
                <span>المبلغ:</span>
                <span>{selectedTransaction.amount.toLocaleString()} {selectedTransaction.currency === 'IQD' ? 'د.ع' : '$'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancies Modal */}
      {showDiscrepanciesModal && selectedTransaction && (
        <div className={styles.modalOverlay} onClick={() => setShowDiscrepanciesModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <h2>🚨 طلبات غير مطابقة للكشف</h2>
              <button className={styles.closeButton} onClick={() => setShowDiscrepanciesModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              {discrepantOrders.map(order => (
                <div key={order.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', color: '#38bdf8' }}>طلب #{order.id.slice(-6).toUpperCase()}</h3>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>المستلم (الإكسل): <span style={{color: '#ef4444', fontWeight: 'bold'}}>{(order.discrepancy_inputted_amount || 0).toLocaleString()}</span> د.ع | المطلوب (النظام): <span style={{color: '#10b981', fontWeight: 'bold'}}>{(order.discrepancy_expected_amount || 0).toLocaleString()}</span> د.ع</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {editingCustomAmountId === order.id ? (
                      <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          value={customAmountValue}
                          onChange={(e) => setCustomAmountValue(e.target.value)}
                          placeholder="المبلغ الجديد..."
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #38bdf8', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                        />
                        <button 
                          onClick={() => handleAcceptCustomAmount(order)}
                          disabled={resolvingOrderId === order.id}
                          style={{ background: '#38bdf8', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}
                        >
                          تأكيد
                        </button>
                        <button 
                          onClick={() => { setEditingCustomAmountId(null); setCustomAmountValue(''); }}
                          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleAcceptPartialAmount(order)}
                          disabled={resolvingOrderId === order.id}
                          style={{ flex: 1, background: '#10b981', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', opacity: resolvingOrderId === order.id ? 0.5 : 1 }}
                        >
                          {resolvingOrderId === order.id ? 'جاري المعالجة...' : 'قبول مبلغ الإكسل'}
                        </button>
                        <button 
                          onClick={() => {
                            setEditingCustomAmountId(order.id);
                            setCustomAmountValue(String(order.discrepancy_inputted_amount || 0));
                          }}
                          disabled={resolvingOrderId === order.id}
                          style={{ flex: 1, background: '#38bdf8', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', opacity: resolvingOrderId === order.id ? 0.5 : 1 }}
                        >
                          تسوية بمبلغ آخر
                        </button>
                        <button 
                          onClick={() => handleClearDiscrepancyFlag(order)}
                          disabled={resolvingOrderId === order.id}
                          style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', opacity: resolvingOrderId === order.id ? 0.5 : 1 }}
                        >
                          {resolvingOrderId === order.id ? 'جاري المعالجة...' : 'تجاهل وإعادة للانتظار'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📄 تفاصيل الطلب <span style={{ color: '#10b981', fontSize: '1rem', marginRight: '0.5rem' }}>#{selectedOrder.id.slice(-6).toUpperCase()}</span></h2>
              <button className={styles.closeButton} onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              {/* Customer Information Grid */}
              <div className={styles.detailsGrid}>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>اسم الزبون</span>
                  <span className={styles.detailsValue}>{selectedOrder.customerName || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>رقم الهاتف</span>
                  <span className={styles.detailsValue} style={{direction: 'ltr', textAlign: 'right'}}>{selectedOrder.customerPhone || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المحافظة</span>
                  <span className={styles.detailsValue}>{selectedOrder.governorate || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>المنطقة</span>
                  <span className={styles.detailsValue}>{selectedOrder.region || '---'}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>تاريخ ووقت الطلب</span>
                  <span className={styles.detailsValue}>{selectedOrder.addDate} - {selectedOrder.addTime}</span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>موظف الخدمة</span>
                  <span className={styles.detailsValue}>
                    {selectedOrder.employeeName || '---'}
                    {selectedOrder.isPaidToStaff && (
                      <span style={{ color: '#10b981', fontSize: '0.8rem', marginRight: '0.5rem' }}>(✔️ تم دفع العمولة)</span>
                    )}
                  </span>
                </div>
                <div className={styles.detailsItem}>
                  <span className={styles.detailsLabel}>حالة الطلب / الشحن</span>
                  <span className={styles.detailsValue} style={{ color: '#fbbf24' }}>
                    {selectedOrder.status === 'delivered' ? 'مكتمل' : selectedOrder.status} ({selectedOrder.fulfillmentStatus || '---'})
                  </span>
                </div>
                {selectedOrder.shipmentCompany && (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>شركة التوصيل</span>
                    <span className={styles.detailsValue}>{selectedOrder.shipmentCompany}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className={styles.itemsTableContainer}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>السعر المفرد</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold' }}>{item.productName || 'صنف غير معروف'}</td>
                          <td>{item.quantity}</td>
                          <td>{new Intl.NumberFormat('en-US').format(item.unitPrice || 0)} د.ع</td>
                          <td style={{ color: '#10B981', fontWeight: 'bold' }}>
                            {new Intl.NumberFormat('en-US').format((item.quantity || 0) * (item.unitPrice || 0))} د.ع
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>لا توجد أصناف في السلة لهذا الطلب</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooterDetails}>
              <div className={styles.notesSection}>
                {selectedOrder.notes ? (
                  <><strong>ملاحظات:</strong> {selectedOrder.notes}</>
                ) : (
                  <span style={{opacity: 0.5}}>لا توجد ملاحظات</span>
                )}
              </div>
              <div className={styles.totalHighlight}>
                <span>المبلغ الكلي:</span>
                <span>{selectedOrder.totalAmount.toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxImage(null)}>×</button>
          <div className={styles.lightboxContainer} onClick={e => e.stopPropagation()}>
            <img src={lightboxImage} alt="مرفق مكبر" className={styles.lightboxImg} />
          </div>
        </div>
      )}
    </div>
  );
}
