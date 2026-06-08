"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';

interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: any;
}

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const categoriesRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expense_categories');
    
    const unsubscribe = onSnapshot(categoriesRef, async (snapshot) => {
      const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ExpenseCategory[];
      
      // If empty, add default categories
      if (snapshot.empty && loading) {
        setLoading(false); // Prevent infinite loop
        const defaults = ['تسويق وإعلانات', 'رواتب وعمولات', 'تغليف ولوجستيك'];
        try {
          const batch = writeBatch(db);
          defaults.forEach(name => {
            const newDocRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expense_categories'));
            batch.set(newDocRef, { name, createdAt: serverTimestamp() });
          });
          await batch.commit();
        } catch (error) {
          console.error("Error adding default categories:", error);
        }
      } else {
        setCategories(catsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
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
      await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expense_categories'), {
        name: inputName.trim(),
        createdAt: serverTimestamp()
      });
      setInputName('');
      showToastMsg("تم إضافة الفئة بنجاح");
    } catch (error) {
      console.error("Error adding category:", error);
      showToastMsg("حدث خطأ أثناء الإضافة", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفئة؟")) return;

    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expense_categories', id));
      showToastMsg("تم حذف الفئة بنجاح");
    } catch (error) {
      console.error("Error deleting category:", error);
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
        <h1 className={styles.title}>إدارة فئات المصروفات</h1>
      </header>

      <div className={styles.card}>
        <div className={styles.addCategoryForm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>اسم الفئة الجديدة</label>
            <input 
              type="text" 
              className={styles.input}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="مثلاً: إيجار المحل، فواتير..."
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <button className={styles.addButton} onClick={handleAdd}>إضافة فئة</button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>اسم الفئة</th>
                <th style={{ width: '100px', textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(cat.id)} title="حذف">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && !loading && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    لا توجد فئات مضافة حالياً
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
