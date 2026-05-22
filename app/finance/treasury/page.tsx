"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, getDocs
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
}


export default function TreasuryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'transfer' | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    const unsubWallets = onSnapshot(collection(db, 'wallets'), (snapshot) => {
      setWallets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
    });

    // Listen to Transactions
    const q = query(collection(db, 'treasury_transactions'), orderBy('createdAt', 'desc'));
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

  const handleOpenModal = (type: 'deposit' | 'withdraw' | 'transfer') => {
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
      await addDoc(collection(db, 'treasury_transactions'), data);
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
    setDeleteConfirmId(null);
    
    try {
      await deleteDoc(doc(db, 'treasury_transactions', id));
      showToastMsg("تم إلغاء الحركة وتحديث الأرصدة بنجاح");
    } catch (err) {
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
      t.details.toLowerCase().includes(q) ||
      walletName.toLowerCase().includes(q) ||
      fromWalletName.toLowerCase().includes(q) ||
      toWalletName.toLowerCase().includes(q) ||
      t.amount.toString().includes(q) ||
      t.date.includes(q)
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
                    <div style={{ fontWeight: '500' }}>{t.details}</div>
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
                    <button 
                      className={styles.revertBtn} 
                      onClick={() => handleRevertTransactionClick(t.id)}
                      title="إلغاء الحركة"
                    >
                      🗑️
                    </button>
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
               activeModal === 'withdraw' ? 'سحب نقدي جديد' : 'تحويل داخلي بين المحافظ'}
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
                  <label className={styles.label}>المبلغ</label>
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
    </div>
  );
}
