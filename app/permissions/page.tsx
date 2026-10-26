"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch
} from 'firebase/firestore';

interface UserPermissions {
  canChangeOrderStatus?: boolean;
  canDeleteOrders?: boolean;
  canViewFinancials?: boolean;
  [key: string]: boolean | undefined;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  authUid?: string;
  linkedEmployeeId: string;
  isOnline: boolean;
  lastActive: any;
  createdAt: any;
  permissions?: UserPermissions;
}

interface Employee {
  id: string;
  name: string;
}

export default function PermissionsPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalPermissions, setModalPermissions] = useState<UserPermissions>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const adminUid = auth.currentUser?.uid || 'anonymous';
    
    // 1. Fetch system users
    const unsubUsers = onSnapshot(collection(db, 'users', adminUid, 'system_users'), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SystemUser[];
      setUsers(data);
    });

    // 2. Fetch employees for mapping
    const unsubEmps = onSnapshot(collection(db, 'users', adminUid, 'employees'), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name
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

  // Quick direct toggle from the card
  const handleQuickToggle = async (user: SystemUser, permissionKey: string, currentValue: boolean) => {
    try {
      const adminUid = auth.currentUser?.uid || 'anonymous';
      const newValue = !currentValue;
      const updatedPermissions: UserPermissions = {
        ...(user.permissions || {}),
        [permissionKey]: newValue
      };

      const batch = writeBatch(db);
      
      // Update system_users
      const userRef = doc(db, 'users', adminUid, 'system_users', user.id);
      batch.update(userRef, { permissions: updatedPermissions });

      // Also sync to employee_mappings if exists
      const mappingUid = user.authUid || user.id;
      if (mappingUid) {
        const mappingRef = doc(db, 'employee_mappings', mappingUid);
        batch.update(mappingRef, { permissions: updatedPermissions });
      }

      await batch.commit();

      if (permissionKey === 'canChangeOrderStatus') {
        showToastMsg(
          newValue 
            ? `تم تفعيل صلاحية تعديل حالة الطلب لـ (${user.name}) بنجاح` 
            : `تم إيقاف صلاحية تعديل حالة الطلب لـ (${user.name})`,
          'success'
        );
      } else if (permissionKey === 'canDeleteOrders') {
        showToastMsg(
          newValue 
            ? `تم تفعيل صلاحية حذف الطلبات لـ (${user.name}) بنجاح` 
            : `تم إيقاف صلاحية حذف الطلبات لـ (${user.name})`,
          'success'
        );
      } else {
        showToastMsg(`تم تحديث الصلاحية لـ (${user.name})`);
      }
    } catch (err) {
      console.error("Error toggling permission:", err);
      showToastMsg("حدث خطأ أثناء حفظ الصلاحية", "error");
    }
  };

  const handleOpenModal = (user: SystemUser) => {
    setSelectedUser(user);
    setModalPermissions(user.permissions || { canChangeOrderStatus: false, canDeleteOrders: false });
    setShowModal(true);
  };

  const handleSaveModal = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const adminUid = auth.currentUser?.uid || 'anonymous';
      const batch = writeBatch(db);

      const userRef = doc(db, 'users', adminUid, 'system_users', selectedUser.id);
      batch.update(userRef, { permissions: modalPermissions });

      const mappingUid = selectedUser.authUid || selectedUser.id;
      if (mappingUid) {
        const mappingRef = doc(db, 'employee_mappings', mappingUid);
        batch.update(mappingRef, { permissions: modalPermissions });
      }

      await batch.commit();
      showToastMsg(`تم حفظ صلاحيات (${selectedUser.name}) بنجاح`);
      setShowModal(false);
    } catch (err) {
      console.error("Error saving permissions:", err);
      showToastMsg("حدث خطأ أثناء حفظ التعديلات", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered list
  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    const empName = employees.find(e => e.id === u.linkedEmployeeId)?.name?.toLowerCase() || '';
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      empName.includes(q)
    );
  });

  const activeOrderPermCount = users.filter(u => u.permissions?.canChangeOrderStatus).length;
  const activeDeletePermCount = users.filter(u => u.permissions?.canDeleteOrders).length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>👮</span> صلاحيات المستخدمين
          </h1>
          <p className={styles.subtitle}>
            التحكم في صلاحيات مستخدمي تطبيق الهاتف ولوحة التحكم وتحديد من يحق له تعديل حالات الطلبات وحذفها
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{users.length}</span>
            <span className={styles.statLabel}>إجمالي المستخدمين</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>🔄</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#10b981' }}>{activeOrderPermCount}</span>
            <span className={styles.statLabel}>مسموح لهم بتعديل الحالة</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>🗑️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#ef4444' }}>{activeDeletePermCount}</span>
            <span className={styles.statLabel}>مسموح لهم بحذف الطلبات</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="ابحث عن مستخدم بالاسم، رقم الهاتف، أو اسم الموظف..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className={styles.usersGrid}>
        {filteredUsers.map((user) => {
          const empName = employees.find(e => e.id === user.linkedEmployeeId)?.name || 'غير محدد';
          const isPhone = user.email?.endsWith('@mansa.app');
          const cleanEmailOrPhone = isPhone ? user.email.replace('@mansa.app', '') : user.email;
          const canChangeStatus = !!user.permissions?.canChangeOrderStatus;
          const canDelete = !!user.permissions?.canDeleteOrders;

          return (
            <div key={user.id} className={styles.userCard}>
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {user.name ? user.name.trim().charAt(0) : '👤'}
                  </div>
                  <div className={styles.userDetails}>
                    <div className={styles.userName}>
                      {user.name}
                      <span 
                        className={styles.onlineDot} 
                        style={{ 
                          backgroundColor: user.isOnline ? '#10b981' : '#64748b',
                          boxShadow: user.isOnline ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'
                        }} 
                        title={user.isOnline ? "متصل الآن" : "غير متصل"}
                      />
                    </div>
                    <div className={styles.userMeta}>
                      <span>{isPhone ? `📱 ${cleanEmailOrPhone}` : `✉️ ${cleanEmailOrPhone}`}</span>
                      <span>•</span>
                      <span>الموظف: {empName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body - Permissions Controls */}
              <div className={styles.cardBody}>
                {/* Permission 1: تعديل حالة الطلب */}
                <div className={styles.permItem}>
                  <div className={styles.permText}>
                    <div className={styles.permTitle}>
                      <span>🔄</span>
                      <span>تعديل حالة الطلب</span>
                    </div>
                    <div className={styles.permDesc}>
                      تغيير حالات الطلبات في تطبيق الموبايل
                    </div>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={canChangeStatus} 
                      onChange={() => handleQuickToggle(user, 'canChangeOrderStatus', canChangeStatus)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                {/* Permission 2: حذف الطلبات */}
                <div className={styles.permItem} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.65rem' }}>
                  <div className={styles.permText}>
                    <div className={styles.permTitle}>
                      <span>🗑️</span>
                      <span>حذف الطلبات</span>
                    </div>
                    <div className={styles.permDesc}>
                      السماح بحذف الطلبات نهائياً من تطبيق الهاتف
                    </div>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={canDelete} 
                      onChange={() => handleQuickToggle(user, 'canDeleteOrders', canDelete)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>

              {/* Card Footer */}
              <div className={styles.cardFooter}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {canChangeStatus ? (
                    <span className={`${styles.badge} ${styles.badgeAllowed}`}>
                      <span>✓</span> تعديل الحالة
                    </span>
                  ) : null}

                  {canDelete ? (
                    <span className={styles.badge} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <span>✓</span> حذف الطلبات
                    </span>
                  ) : null}

                  {!canChangeStatus && !canDelete ? (
                    <span className={`${styles.badge} ${styles.badgeDenied}`}>
                      <span>✕</span> بدون صلاحيات
                    </span>
                  ) : null}
                </div>

                <button 
                  className={styles.manageBtn}
                  onClick={() => handleOpenModal(user)}
                >
                  <span>⚙️</span> إدارة الصلاحيات
                </button>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', opacity: 0.6, color: 'var(--text-muted)' }}>
            لا يوجد مستخدمين مطابقين للبحث
          </div>
        )}
      </div>

      {/* Permissions Detailed Modal */}
      {showModal && selectedUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <span>⚙️</span> إدارة صلاحيات: {selectedUser.name}
              </h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              {/* User Banner */}
              <div className={styles.modalUserBanner}>
                <div className={styles.avatar}>
                  {selectedUser.name ? selectedUser.name.trim().charAt(0) : '👤'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{selectedUser.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    {selectedUser.email?.endsWith('@mansa.app') 
                      ? `📱 ${selectedUser.email.replace('@mansa.app', '')}` 
                      : `✉️ ${selectedUser.email}`}
                  </div>
                </div>
              </div>

              {/* Permissions list */}
              <div>
                <div className={styles.permSectionTitle}>
                  <span>📱</span> صلاحيات تطبيق الهاتف والمنصة
                </div>

                {/* Permission 1: تعديل حالة الطلب */}
                <div className={`${styles.permBox} ${modalPermissions.canChangeOrderStatus ? styles.permBoxActive : ''}`}>
                  <div className={styles.permText}>
                    <div className={styles.permTitle}>
                      <span>🔄</span> تعديل حالة الطلب (Order Status)
                    </div>
                    <div className={styles.permDesc}>
                      السماح للمستخدم بتغيير حالات الطلبات (قيد الانتظار، تم التجهيز، قيد التوصيل، مؤجل، راجع، ملغي، تم التسليم) وتحديثها مباشرة من الهاتف.
                    </div>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={!!modalPermissions.canChangeOrderStatus} 
                      onChange={(e) => setModalPermissions({ ...modalPermissions, canChangeOrderStatus: e.target.checked })}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                {/* Permission 2: حذف الطلبات */}
                <div className={`${styles.permBox} ${modalPermissions.canDeleteOrders ? styles.permBoxActive : ''}`}>
                  <div className={styles.permText}>
                    <div className={styles.permTitle}>
                      <span>🗑️</span> حذف الطلبات (Delete Orders)
                    </div>
                    <div className={styles.permDesc}>
                      السماح للمستخدم بحذف الطلبات نهائياً من داخل تطبيق الهاتف، مع استرجاع مواد المخزن المحجوزة تلقائياً.
                    </div>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={!!modalPermissions.canDeleteOrders} 
                      onChange={(e) => setModalPermissions({ ...modalPermissions, canDeleteOrders: e.target.checked })}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                إلغاء
              </button>
              <button 
                type="button" 
                className={styles.saveBtn} 
                onClick={handleSaveModal}
                disabled={isSaving}
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ الصلاحيات 💾'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
