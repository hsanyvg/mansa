"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore';

interface ShippingCompany {
  id: string;
  name: string;
  createdAt: any;
  rates?: Record<string, number>;
}

const GOVERNORATES = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'بابل', 'ذي قار', 'الأنبار', 'واسط',
  'النجف', 'كربلاء', 'السليمانية', 'كركوك', 'ميسان', 'ديالى', 'القادسية', 'المثنى', 'دهوك', 'صلاح الدين'
];

export default function ShippingCompaniesPage() {
  const [companies, setCompanies] = useState<ShippingCompany[]>([]);
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [editingRatesId, setEditingRatesId] = useState<string | null>(null);
  const [ratesData, setRatesData] = useState<Record<string, number>>({});
  const [unifiedRate, setUnifiedRate] = useState<string>('');

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

  const handleSaveRates = async () => {
    if (!editingRatesId) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'shipping_companies', editingRatesId), {
        rates: ratesData
      });
      showToastMsg("تم حفظ أسعار التوصيل بنجاح");
      setEditingRatesId(null);
    } catch (error) {
      console.error("Error updating rates:", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleUnifyRates = () => {
    const rate = Number(unifiedRate);
    if (!rate || rate < 0) return;
    const newRates: Record<string, number> = { ...ratesData };
    GOVERNORATES.forEach(gov => {
      newRates[gov] = rate;
    });
    setRatesData(newRates);
    setUnifiedRate('');
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
                    <button 
                      className={styles.editBtn} 
                      onClick={() => {
                        setEditingRatesId(cat.id);
                        setRatesData(cat.rates || {});
                      }} 
                      title="تعديل أسعار التوصيل" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginRight: '10px' }}
                    >
                      💰
                    </button>
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

      {editingRatesId && (
        <div className={styles.modalOverlay} onClick={() => setEditingRatesId(null)}>
          <div className={styles.ratesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>أسعار التوصيل للمحافظات</h2>
              <button className={styles.closeBtn} onClick={() => setEditingRatesId(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <label className={styles.label} style={{ marginBottom: '0.5rem', display: 'block' }}>توحيد تكلفة التوصيل لجميع المحافظات</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      className={styles.input}
                      value={unifiedRate}
                      onChange={e => setUnifiedRate(e.target.value)}
                      placeholder="رقم (مثال: 5000)"
                      style={{ flex: 1 }}
                    />
                    <button 
                      className={styles.addButton} 
                      onClick={handleUnifyRates}
                      style={{ height: 'auto', padding: '0 1.5rem' }}
                    >
                      تطبيق على الكل
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.ratesGrid}>
                {GOVERNORATES.map(gov => (
                  <div key={gov} className={styles.rateGroup}>
                    <label>{gov}</label>
                    <input 
                      type="number" 
                      className={styles.input}
                      value={ratesData[gov] || ''} 
                      onChange={e => setRatesData({...ratesData, [gov]: Number(e.target.value) || 0})}
                      placeholder="مثال: 5000"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditingRatesId(null)}>إلغاء</button>
              <button className={styles.saveBtn} onClick={handleSaveRates}>حفظ الأسعار</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
