"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

interface Wallet {
  id: string;
  name: string;
  createdAt: any;
}

export default function WalletsManagementPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const q = query(collection(db, 'wallets'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWallets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
      setLoading(false);
    });

    return () => unsub();
  }, [isMounted]);

  const showToastMsg = (m: string, t: 'success' | 'error' = 'success') => {
    setToast({ message: m, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) {
      return showToastMsg("يرجى إدخال اسم الخزنة", "error");
    }

    // Check for duplicates
    if (wallets.some(w => w.name.toLowerCase() === newWalletName.trim().toLowerCase())) {
      return showToastMsg("اسم الخزنة موجود مسبقاً", "error");
    }

    try {
      await addDoc(collection(db, 'wallets'), {
        name: newWalletName.trim(),
        createdAt: serverTimestamp()
      });
      showToastMsg("تم إضافة الخزنة بنجاح");
      setNewWalletName('');
    } catch (err) {
      showToastMsg("حدث خطأ أثناء الإضافة", "error");
    }
  };

  const handleDeleteWallet = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف خزنة "${name}"؟`)) return;
    
    try {
      await deleteDoc(doc(db, 'wallets', id));
      showToastMsg("تم الحذف بنجاح");
    } catch (err) {
      showToastMsg("حدث خطأ أثناء الحذف", "error");
    }
  };

  if (!isMounted) return null;

  return (
    <div className={styles.container}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}

      <header className={styles.header}>
        <h1 className={styles.title}>إدارة الخزنات والمحافظ</h1>
      </header>

      <div className={styles.card}>
        <form className={styles.formGrid} onSubmit={handleAddWallet}>
          <div className={styles.formGroup}>
            <label className={styles.label}>اسم الخزنة / المحفظة الجديدة</label>
            <input 
              type="text" 
              className={styles.input} 
              value={newWalletName} 
              onChange={e => setNewWalletName(e.target.value)}
              placeholder="مثال: صندوق الكاش، زين كاش، حساب البنك..."
              required
            />
          </div>
          <button type="submit" className={styles.submitBtn}>
            ➕ إضافة
          </button>
        </form>
      </div>

      <section className={styles.tableSection}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الخزنة</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet, index) => (
                <tr key={wallet.id}>
                  <td>{index + 1}</td>
                  <td className={styles.walletName}>🏦 {wallet.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div className={styles.actionButtons} style={{ justifyContent: 'center' }}>
                      <button 
                        className={styles.deleteBtn} 
                        onClick={() => handleDeleteWallet(wallet.id, wallet.name)}
                        title="حذف"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {wallets.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📭</span>
              <p>لا توجد خزنات مضافة حالياً</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
