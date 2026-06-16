"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth, firebaseConfig } from "../../lib/firebase";
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  serverTimestamp, 
  writeBatch
} from 'firebase/firestore';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  authUid: string;
  linkedEmployeeId: string;
  isOnline: boolean;
  lastActive: any;
  createdAt: any;
  password?: string;
}

interface Employee {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    linkedEmployeeId: ''
  });

  useEffect(() => {
    const adminUid = auth.currentUser?.uid || 'anonymous';
    
    // Fetch system users
    const unsubUsers = onSnapshot(collection(db, 'users', adminUid, 'system_users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SystemUser[];
      setUsers(data);
    });

    // Fetch employees for dropdown
    const unsubEmps = onSnapshot(collection(db, 'users', adminUid, 'employees'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Employee[];
      setEmployees(data);
    });

    return () => {
      unsubUsers();
      unsubEmps();
    };
  }, []);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = () => {
    setEditingId(null);
    setShowPassword(false);
    setFormData({
      name: '',
      email: '',
      password: '',
      linkedEmployeeId: ''
    });
    setShowModal(true);
  };

  const handleEdit = (user: SystemUser) => {
    setEditingId(user.id);
    setShowPassword(false);
    setFormData({
      name: user.name,
      email: user.email,
      password: user.password || '',
      linkedEmployeeId: user.linkedEmployeeId
    });
    setShowModal(true);
  };

  const handleDelete = async (user: SystemUser) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستخدم ${user.name}؟`)) return;
    try {
      const adminUid = auth.currentUser?.uid || 'anonymous';
      const batch = writeBatch(db);
      
      const userRef = doc(db, 'users', adminUid, 'system_users', user.id);
      batch.delete(userRef);
      
      if (user.authUid || user.id) {
        const mappingRef = doc(db, 'employee_mappings', user.authUid || user.id);
        batch.delete(mappingRef);
        
        // Delete from Firebase Auth via our new API
        try {
          await fetch('/api/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.authUid || user.id })
          });
        } catch(e) {
          console.error("Failed to delete from Auth:", e);
        }
      }
      
      await batch.commit();
      showToastMsg("تم حذف المستخدم بنجاح");
    } catch (error) {
      console.error("Delete error:", error);
      showToastMsg("حدث خطأ أثناء الحذف", "error");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.linkedEmployeeId) {
      showToastMsg("يرجى ملء الحقول المطلوبة", "error");
      return;
    }

    try {
      const batch = writeBatch(db);
      const adminUid = auth.currentUser?.uid || 'anonymous';

      if (editingId) {
        const userRef = doc(db, 'users', adminUid, 'system_users', editingId);
        
        const updateData: any = {
          name: formData.name,
          linkedEmployeeId: formData.linkedEmployeeId
        };
        
        if (formData.email) {
          updateData.email = formData.email.trim();
        }
        if (formData.password) {
          updateData.password = formData.password;
        }

        batch.update(userRef, updateData);
        
        const mappingRef = doc(db, 'employee_mappings', editingId);
        const mappingData: any = {
          employeeId: formData.linkedEmployeeId
        };
        if (formData.email) {
          mappingData.email = formData.email.trim();
        }
        batch.update(mappingRef, mappingData);
        
        // Update Auth via API
        if (formData.email || formData.password) {
          try {
            const res = await fetch('/api/users/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                uid: editingId, 
                email: formData.email.trim() || undefined,
                password: formData.password || undefined
              })
            });
            const data = await res.json();
            if (data.error) {
               showToastMsg(`حدث خطأ أثناء تحديث الإيميل/الباسوورد: ${data.error}`, "error");
               return; // Stop saving if Auth update failed
            }
          } catch(e) {
            console.error("Auth update API error:", e);
          }
        }
        
        await batch.commit();
        showToastMsg("تم تحديث بيانات المستخدم بنجاح");
      } else {
        if (!formData.email || !formData.password) {
          showToastMsg("يرجى ملء الإيميل وكلمة المرور", "error");
          return;
        }
        let employeeAuthUid = null;
        let employeeEmail = formData.email.trim();

        // Initialize Secondary App
        const apps = getApps();
        const secondaryApp = apps.find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, employeeEmail, formData.password);
          employeeAuthUid = userCred.user.uid;
        } catch (authErr: any) {
          console.error("Auth creation error", authErr);
          let errStr = "حدث خطأ أثناء إنشاء حساب المستخدم (ربما البريد مستخدم مسبقاً).";
          if (authErr.code === 'auth/email-already-in-use') errStr = 'البريد الإلكتروني مستخدم بالفعل.';
          else if (authErr.code === 'auth/weak-password') errStr = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
          showToastMsg(errStr, "error");
          return;
        }

        const userRef = doc(db, 'users', adminUid, 'system_users', employeeAuthUid);
        
        const newData: any = {
          name: formData.name,
          email: employeeEmail,
          authUid: employeeAuthUid,
          linkedEmployeeId: formData.linkedEmployeeId,
          isOnline: false,
          lastActive: null,
          createdAt: serverTimestamp(),
          password: formData.password
        };
        
        const mappingRef = doc(db, 'employee_mappings', employeeAuthUid);
        batch.set(mappingRef, {
          adminUid: adminUid,
          employeeId: formData.linkedEmployeeId,
          email: employeeEmail
        });
        
        batch.set(userRef, newData);
        await batch.commit();
        
        showToastMsg("تم إضافة المستخدم بنجاح");
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving user:", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>إدارة المستخدمين</h1>
        <button className={styles.addButton} onClick={handleOpenModal}>
          <span>+</span> إضافة مستخدم جديد
        </button>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="ابحث عن مستخدم بالاسم أو الإيميل..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>اسم المستخدم</th>
                <th>البريد الإلكتروني</th>
                <th>الموظف المرتبط</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const empName = employees.find(e => e.id === user.linkedEmployeeId)?.name || 'غير معروف';
                return (
                  <tr key={user.id}>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {user.name}
                        <span title={user.isOnline ? "متصل الآن" : "غير متصل"} style={{
                          display: 'inline-block',
                          width: '10px', height: '10px', borderRadius: '50%',
                          backgroundColor: user.isOnline ? '#10b981' : '#64748b',
                          boxShadow: user.isOnline ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
                        }}></span>
                      </div>
                      {user.lastActive && !user.isOnline && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          آخر ظهور: {user.lastActive.toDate ? user.lastActive.toDate().toLocaleString('en-GB') : new Date(user.lastActive).toLocaleString('en-GB')}
                        </div>
                      )}
                    </td>
                    <td>{user.email}</td>
                    <td>{empName}</td>
                    <td>{user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => handleEdit(user)} title="تعديل">
                          ✏️
                        </button>
                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(user)} title="حذف">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    لا يوجد مستخدمين مضافين حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>الاسم *</label>
                    <input type="text" className={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>البريد الإلكتروني *</label>
                    <input type="email" className={styles.input} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="example@mansa.com" required />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>كلمة المرور {!editingId && '*'}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className={styles.input} 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        placeholder={editingId && formData.password ? "كلمة المرور الحالية" : "أدخل كلمة مرور (6 أحرف على الأقل)"} 
                        required={!editingId && !formData.password} 
                        style={{ paddingLeft: '40px' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        style={{ position: 'absolute', left: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
                      >
                        {showPassword ? "👁️" : "👁️‍🗨️"}
                      </button>
                    </div>
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>الموظف المرتبط به *</label>
                    <select className={styles.select} value={formData.linkedEmployeeId} onChange={e => setFormData({...formData, linkedEmployeeId: e.target.value})} required>
                      <option value="">-- اختر موظف --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      الطلبات التي يقوم بها هذا المستخدم في تطبيق الهاتف ستسجل باسم الموظف الذي تختاره هنا.
                    </small>
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

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
