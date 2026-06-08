"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';

interface MetaAccount {
  id: string;
  name: string;
  accessToken: string;
  adAccountId: string;
  isActive: boolean;
}

export default function ApiIntegrationsPage() {
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<'list' | 'add' | 'edit'>('list');
  const [selectedAccount, setSelectedAccount] = useState<MetaAccount | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Connection feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delivery Integration States
  const [deliveryUsername, setDeliveryUsername] = useState('');
  const [deliveryPassword, setDeliveryPassword] = useState('');
  const [deliverySystemCode, setDeliverySystemCode] = useState('');
  const [isDeliveryLinked, setIsDeliveryLinked] = useState(false);
  const [isDeliveryManagerOpen, setIsDeliveryManagerOpen] = useState(false);
  
  // TODO: Update this when real Auth is implemented
  const currentUserId = 'default_tenant'; 

  // Real-time listener for accounts
  useEffect(() => {
    const accountsRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts');
    const unsubscribeMeta = onSnapshot(accountsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MetaAccount[];
      setMetaAccounts(data);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching API configurations:', err);
      setIsLoading(false);
    });

    // Delivery Integration listener
    const deliveryRef = doc(db, 'users', currentUserId, 'integrations', 'delivery');
    const unsubscribeDelivery = onSnapshot(deliveryRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDeliveryUsername(data.username || '');
        setDeliveryPassword(data.password || '');
        setDeliverySystemCode(data.systemCode || '');
        setIsDeliveryLinked(!!data.username && !!data.password);
      } else {
        setIsDeliveryLinked(false);
      }
    });

    return () => {
      unsubscribeMeta();
      unsubscribeDelivery();
    };
  }, []);

  const handleOpenManager = () => {
    setActiveForm('list');
    setIsManagerOpen(true);
  };

  const handleCloseManager = () => {
    setIsManagerOpen(false);
    setFeedback(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setAccessToken('');
    setAdAccountId('');
    setIsActive(true);
    setSelectedAccount(null);
    setFeedback(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setActiveForm('add');
  };

  const handleOpenEditForm = (account: MetaAccount) => {
    setSelectedAccount(account);
    setName(account.name || '');
    setAccessToken(account.accessToken || '');
    setAdAccountId(account.adAccountId || '');
    setIsActive(account.isActive !== false);
    setFeedback(null);
    setActiveForm('edit');
  };

  const handleTestConnection = async () => {
    if (!accessToken || !adAccountId) {
      setFeedback({ type: 'error', message: 'الرجاء إدخال رمز الوصول ومعرف الحساب أولاً.' });
      return;
    }

    setIsTesting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/verify-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, adAccountId })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedback({ 
          type: 'error', 
          message: `فشل الاتصال: ${data.error || 'البيانات غير صحيحة.'}` 
        });
      } else {
        setFeedback({ 
          type: 'success', 
          message: `✅ تم الاتصال بنجاح! اسم الحساب: ${data.name} (${data.currency})` 
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'حدث خطأ أثناء محاولة الاتصال بالخادم.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !adAccountId) {
      setFeedback({ type: 'error', message: 'الرجاء ملء جميع الحقول المطلوبة.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        name,
        accessToken,
        adAccountId,
        isActive,
        updatedAt: new Date()
      };

      if (activeForm === 'edit' && selectedAccount) {
        const docRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts', selectedAccount.id);
        await updateDoc(docRef, payload);
        alert('تم تحديث الحساب بنجاح!');
      } else {
        const collRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts');
        await addDoc(collRef, {
          ...payload,
          createdAt: new Date()
        });
        alert('تم إضافة الحساب الجديد بنجاح!');
      }
      
      setActiveForm('list');
      resetForm();
    } catch (err: any) {
      console.error('Error saving Meta account:', err);
      setFeedback({ type: 'error', message: 'حدث خطأ أثناء حفظ الإعدادات.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الحساب الإعلاني بالكامل؟')) return;

    try {
      const docRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts', id);
      await deleteDoc(docRef);
      alert('تم حذف الحساب بالكامل.');
      if (selectedAccount?.id === id) {
        resetForm();
      }
      setActiveForm('list');
    } catch (err) {
      console.error('Error deleting configuration:', err);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  const handleToggleStatusDirectly = async (account: MetaAccount, e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const docRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts', account.id);
      await updateDoc(docRef, { isActive: e.target.checked });
    } catch (err) {
      console.error('Error toggling status:', err);
      alert('حدث خطأ أثناء تعديل حالة الحساب.');
    }
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, 'users', currentUserId, 'integrations', 'delivery');
      await setDoc(docRef, {
        username: deliveryUsername,
        password: deliveryPassword, // NOTE: In production, password should be encrypted
        systemCode: deliverySystemCode,
        updatedAt: new Date()
      }, { merge: true });
      alert('تم حفظ إعدادات شركة التوصيل بنجاح!');
      setIsDeliveryManagerOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlinkDelivery = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء الربط مع شركة التوصيل؟')) return;
    try {
      const docRef = doc(db, 'users', currentUserId, 'integrations', 'delivery');
      await deleteDoc(docRef);
      setDeliveryUsername('');
      setDeliveryPassword('');
      setDeliverySystemCode('');
      alert('تم إلغاء الربط بنجاح.');
      setIsDeliveryManagerOpen(false);
    } catch(err) {
      console.error(err);
      alert('حدث خطأ أثناء إلغاء الربط');
    }
  };

  const activeAccountsCount = metaAccounts.filter(a => a.isActive).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          🔌 بوابة الربط والتكامل (API Gateways)
        </div>
        <div className={styles.subtitle}>
          إدارة وتفعيل الربط المباشر مع الحسابات والمنصات الخارجية وسحب أرقام الإنفاق بشكل آمن وديناميكي.
        </div>
      </header>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          جاري تحميل بوابات الربط المتاحة...
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Meta Ads Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🔵</div>
              <span className={`${styles.statusText} ${activeAccountsCount > 0 ? styles.statusActive : styles.statusInactive}`}>
                {activeAccountsCount > 0 ? `نشط (${activeAccountsCount} حسابات)` : 'غير متصل'}
              </span>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.cardInfo}>
                <h3>ربط إعلانات ميتا (Meta Ads API)</h3>
              </div>
              <p className={styles.cardDesc}>
                يسمح بربط حسابات إعلانية متعددة وسحب كلف الإعلانات بشكل مستقل ومطابقتها مع المنتجات لحساب تكلفة الاستحواذ (CPA) بدقة لكل حساب.
              </p>
              
              {metaAccounts.length > 0 && (
                <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>الحسابات المربوطة:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {metaAccounts.map(acc => (
                      <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span style={{ opacity: acc.isActive ? 1 : 0.5 }}>• {acc.name} ({acc.adAccountId})</span>
                        <span style={{ color: acc.isActive ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {acc.isActive ? 'مفعل' : 'موقف'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.cardFooter}>
              <button className={styles.btnConfig} onClick={handleOpenManager}>
                ⚙️ {metaAccounts.length > 0 ? 'إدارة الحسابات المربوطة' : 'إعداد الاتصال'}
              </button>
            </div>
          </div>

          {/* Delivery Integration Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🚚</div>
              <span className={`${styles.statusText} ${isDeliveryLinked ? styles.statusActive : styles.statusInactive}`}>
                {isDeliveryLinked ? 'مربوط نشط' : 'غير متصل'}
              </span>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.cardInfo}>
                <h3>شركة التوصيل (Jenni Logistics)</h3>
              </div>
              <p className={styles.cardDesc}>
                ربط حسابك مع شركة التوصيل لإرسال الطلبات مباشرة عند التأكيد وتتبع الحالة آلياً داخل المنصة.
              </p>
            </div>

            <div className={styles.cardFooter}>
              <button className={styles.btnConfig} onClick={() => setIsDeliveryManagerOpen(true)}>
                ⚙️ {isDeliveryLinked ? 'إدارة الربط' : 'إعداد الاتصال'}
              </button>
            </div>
          </div>

          {/* TikTok Placeholder */}
          <div className={styles.card} style={{ opacity: 0.5, pointerEvents: 'none' }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>⚫</div>
              <span className={`${styles.statusText} ${styles.statusInactive}`}>
                قريباً
              </span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardInfo}>
                <h3>إعلانات تيك توك (TikTok Ads API)</h3>
              </div>
              <p className={styles.cardDesc}>
                مزامنة تلقائية للحملات وتتبع التكاليف على منصة تيك توك ومطابقة أكواد المنتجات.
              </p>
            </div>
            <div className={styles.cardFooter}>
              <button className={styles.btnConfig} disabled>
                غير متاح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Manager Modal */}
      {isManagerOpen && (
        <div className={styles.overlay} onClick={handleCloseManager}>
          <div className={styles.modal} style={{ maxWidth: activeForm === 'list' ? '680px' : '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                🔵 {activeForm === 'list' ? 'إدارة حسابات إعلانات ميتا' : activeForm === 'add' ? 'إضافة حساب إعلاني جديد' : 'تعديل حساب إعلاني'}
              </div>
              <button className={styles.closeBtn} onClick={handleCloseManager}>&times;</button>
            </div>

            {/* List View */}
            {activeForm === 'list' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>قائمة حسابات فيسبوك النشطة والمربوطة بالنظام:</span>
                  <button className={styles.btnSave} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={handleOpenAddForm}>
                    ➕ إضافة حساب جديد
                  </button>
                </div>

                {metaAccounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                    لا توجد أي حسابات مربوطة بعد. اضغط على "إضافة حساب جديد" للبدء.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingLeft: '5px' }}>
                    {metaAccounts.map(account => (
                      <div 
                        key={account.id} 
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff', marginBottom: '0.2rem' }}>
                            {account.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            ID: {account.adAccountId}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          {/* Toggle Status */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: account.isActive ? '#10b981' : 'var(--text-muted)' }}>
                              {account.isActive ? 'مفعل' : 'معطل'}
                            </span>
                            <label className={styles.toggleSwitch}>
                              <input 
                                type="checkbox" 
                                checked={account.isActive} 
                                onChange={(e) => handleToggleStatusDirectly(account, e)}
                              />
                              <span className={styles.slider}></span>
                            </label>
                          </div>

                          {/* Edit / Delete */}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className={styles.btnConfig} 
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                              onClick={() => handleOpenEditForm(account)}
                            >
                              ✏️
                            </button>
                            <button 
                              className={styles.btnDelete} 
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                              onClick={(e) => handleDelete(account.id, e)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add / Edit Form */}
            {(activeForm === 'add' || activeForm === 'edit') && (
              <form onSubmit={handleSave}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم الحساب الإعلاني (Connection Name)</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="مثال: حساب إعلانات حسان الأساسي"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>رمز الوصول (Meta Access Token)</label>
                  <input 
                    type="password" 
                    className={styles.input} 
                    value={accessToken} 
                    onChange={(e) => setAccessToken(e.target.value)} 
                    placeholder="ألصق الـ Token السري الطويل الخاص بهذا الحساب"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>معرّف الحساب الإعلاني (Ad Account ID)</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={adAccountId} 
                    onChange={(e) => setAdAccountId(e.target.value)} 
                    placeholder="مثال: 122123353335240568"
                    required
                  />
                </div>

                <div className={styles.toggleContainer}>
                  <span className={styles.toggleLabel}>تفعيل هذا الحساب فوراً</span>
                  <label className={styles.toggleSwitch}>
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                {feedback && (
                  <div className={`${styles.feedbackBox} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                    {feedback.message}
                  </div>
                )}

                <div className={styles.actions}>
                  <button type="button" className={styles.btnConfig} onClick={() => setActiveForm('list')} style={{ marginLeft: 'auto' }}>
                    ⬅️ رجوع للقائمة
                  </button>

                  <button type="button" className={styles.btnTest} onClick={handleTestConnection} disabled={isTesting || isSaving}>
                    {isTesting ? 'جاري التحقق...' : '🔌 اختبار الاتصال'}
                  </button>
                  
                  <button type="submit" className={styles.btnSave} disabled={isSaving || isTesting}>
                    {isSaving ? 'جاري الحفظ...' : '💾 حفظ الحساب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delivery Manager Modal */}
      {isDeliveryManagerOpen && (
        <div className={styles.overlay} onClick={() => setIsDeliveryManagerOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>🚚 ربط شركة التوصيل (Jenni)</div>
              <button className={styles.closeBtn} onClick={() => setIsDeliveryManagerOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSaveDelivery}>
              <div className={styles.formGroup}>
                <label className={styles.label}>رمز النظام (System Code)</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={deliverySystemCode} 
                  onChange={(e) => setDeliverySystemCode(e.target.value)} 
                  placeholder="مثال: TAJER_123"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>اسم المستخدم (Username)</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={deliveryUsername} 
                  onChange={(e) => setDeliveryUsername(e.target.value)} 
                  placeholder="ادخل اسم المستخدم لشركة التوصيل"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>كلمة المرور (Password)</label>
                <input 
                  type="password" 
                  className={styles.input} 
                  value={deliveryPassword} 
                  onChange={(e) => setDeliveryPassword(e.target.value)} 
                  placeholder="ادخل كلمة المرور"
                  required
                />
                <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>
                  ملاحظة أمنية: يتم حماية البيانات وفق معايير Firebase، وسيتم استخدامها تلقائياً لإرسال الطلبات.
                </p>
              </div>

              <div className={styles.actions}>
                {isDeliveryLinked && (
                  <button type="button" className={styles.btnDelete} onClick={handleUnlinkDelivery} disabled={isSaving}>
                    إلغاء الربط
                  </button>
                )}
                <button type="submit" className={styles.btnSave} disabled={isSaving} style={{ marginLeft: 'auto' }}>
                  {isSaving ? 'جاري الحفظ...' : '💾 حفظ وإغلاق'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
