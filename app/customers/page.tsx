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
  orderBy 
} from 'firebase/firestore';

interface Customer {
  id: string;
  name: string;
  phone: string;
  province: string;
  area: string;
  detailedAddress: string;
  notes: string;
  tag: string;
  createdAt: any;
  updatedAt: any;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    province: '',
    area: '',
    detailedAddress: '',
    notes: '',
    tag: ''
  });

  const iraqiProvinces = [
    "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", 
    "ذي قار", "بابل", "ميسان", "الأنبار", "كركوك", "صلاح الدين", 
    "واسط", "القادسية", "السليمانية", "دهوك", "ديالى", "المثنى"
  ];

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(data);
    });
    return () => unsubscribe();
  }, []);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingId(customer.id);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        province: customer.province,
        area: customer.area,
        detailedAddress: customer.detailedAddress,
        notes: customer.notes,
        tag: customer.tag
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        phone: '',
        province: '',
        area: '',
        detailedAddress: '',
        notes: '',
        tag: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      showToastMsg("الاسم ورقم الهاتف حقول إجبارية", "error");
      return;
    }

    try {
      const payload = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), payload);
        showToastMsg("تم تحديث بيانات العميل بنجاح");
      } else {
        await addDoc(collection(db, 'customers'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        showToastMsg("تم إضافة العميل بنجاح");
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving customer:", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف العميل "${name}"؟`)) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        showToastMsg("تم حذف العميل بنجاح");
      } catch (error) {
        console.error("Error deleting customer:", error);
        showToastMsg("حدث خطأ أثناء الحذف", "error");
      }
    }
  };

  const getWhatsappLink = (phone: string) => {
    let cleanPhone = phone.trim();
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('964') && !cleanPhone.startsWith('+964')) {
      cleanPhone = '964' + cleanPhone;
    }
    // Remove any non-numeric characters
    cleanPhone = cleanPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>قائمة العملاء</h1>
        <div className={styles.headerActions}>
          <button className={styles.addButton} onClick={() => handleOpenModal()}>
            <span>+ إضافة عميل جديد</span>
          </button>
        </div>
      </header>

      <section className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input 
            type="text" 
            placeholder="بحث بالاسم أو رقم الهاتف..." 
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
              <th>الاسم</th>
              <th>رقم الهاتف</th>
              <th>المحافظة</th>
              <th>المنطقة</th>
              <th>الوسم</th>
              <th>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className={styles.customerName}>{customer.name}</td>
                  <td>
                    <div className={styles.phoneCell}>
                      {customer.phone}
                      <a 
                        href={getWhatsappLink(customer.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.whatsappIcon}
                        title="فتح واتساب"
                      >
                        <span style={{ fontSize: '1.2rem' }}>💬</span>
                      </a>
                    </div>
                  </td>
                  <td>{customer.province || '---'}</td>
                  <td>{customer.area || '---'}</td>
                  <td>
                    {customer.tag ? (
                      <span className={styles.tagBadge}>{customer.tag}</span>
                    ) : (
                      '---'
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button 
                        className={`${styles.actionBtn} ${styles.editBtn}`}
                        onClick={() => handleOpenModal(customer)}
                        title="تعديل"
                      >
                        ✏️
                      </button>
                      <button 
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(customer.id, customer.name)}
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  <div className={styles.emptyIcon}>👥</div>
                  {searchTerm ? 'لا توجد نتائج تطابق بحثك' : 'لا يوجد عملاء حالياً. أضف عميلاً لتبدأ.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h2>
              <button className={styles.closeButton} onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      الاسم <span className={styles.required}>*</span>
                    </label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                      placeholder="أدخل اسم العميل الكامل"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      رقم الهاتف <span className={styles.required}>*</span>
                    </label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                      placeholder="مثال: 07800000000"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>المحافظة</label>
                    <select 
                      className={styles.select}
                      value={formData.province}
                      onChange={(e) => setFormData({...formData, province: e.target.value})}
                    >
                      <option value="">إختر المحافظة</option>
                      {iraqiProvinces.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>المنطقة</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={formData.area}
                      onChange={(e) => setFormData({...formData, area: e.target.value})}
                      placeholder="اسم الحي أو المنطقة"
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>العنوان التفصيلي</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={formData.detailedAddress}
                      onChange={(e) => setFormData({...formData, detailedAddress: e.target.value})}
                      placeholder="رقم الزقاق، المحلة، أو علامة دالة"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>وسم العميل (Tag)</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={formData.tag}
                      onChange={(e) => setFormData({...formData, tag: e.target.value})}
                      placeholder="مثال: VIP، عميل دائم"
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>ملاحظات</label>
                    <textarea 
                      className={styles.textarea}
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="أي ملاحظات إضافية عن العميل..."
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} onClick={handleCloseModal}>إلغاء</button>
                <button type="submit" className={styles.saveButton}>
                  {editingId ? 'تحديث البيانات' : 'حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
