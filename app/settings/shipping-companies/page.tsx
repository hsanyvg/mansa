"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';

interface ShippingCompany {
  id: string;
  name: string;
  createdAt: any;
}

export default function ShippingCompaniesPage() {
  const [companies, setCompanies] = useState<ShippingCompany[]>([]);
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const companiesRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies');
    
    const unsubscribe = onSnapshot(companiesRef, async (snapshot) => {
      const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ShippingCompany[];
      
      // If empty, add default categories
      if (snapshot.empty && loading) {
        setLoading(false); // Prevent infinite loop
        const defaults = ['شركة زاجل', 'شركة النبع', 'جيني', 'مندوب خاص'];
        try {
          const batch = writeBatch(db);
          defaults.forEach(name => {
            const newDocRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies'));
            batch.set(newDocRef, { name, createdAt: serverTimestamp() });
          });
          await batch.commit();
        } catch (error) {
          console.error("Error adding default shipping companies:", error);
        }
      } else {
        setCompanies(docsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [loading]);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async () => {
    if (!inputName.trim()) return;

    try {
      await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies'), {
        name: inputName.trim(),
        createdAt: serverTimestamp()
      });
      setInputName('');
      showToastMsg("تم إضافة شركة الشحن بنجاح");
    } catch (error) {
      console.error("Error adding shipping company:", error);
      showToastMsg("حدث خطأ أثناء الإضافة", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف شركة الشحن هذه؟")) return;

    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies', id));
      showToastMsg("تم حذف الشركة بنجاح");
    } catch (error) {
      console.error("Error deleting shipping company:", error);
      showToastMsg("حدث خطأ أثناء الحذف", "error");
    }
  };

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>إدارة شركات الشحن</h1>
      </header>

      <div className={styles.card}>
        <div className={styles.addCategoryForm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>اسم شركة الشحن</label>
            <input 
              type="text" 
              className={styles.input}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="مثلاً: شركة زاجل، مندوب خاص..."
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <button className={styles.addButton} onClick={handleAdd}>إضافة الشركة</button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>اسم الشركة</th>
                <th style={{ width: '100px', textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(cat.id)} title="حذف">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && !loading && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    لا توجد شركات شحن مضافة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
