"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Connection {
  id: string;
  name: string;
  pixelId: string;
  accessToken?: string;
  testEventCode: string;
  linkedProducts?: string[];
}

interface Product {
  id: string;
  name: string;
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'meta' | 'tiktok'>('meta');
  
  const [metaConnections, setMetaConnections] = useState<Connection[]>([]);
  const [tiktokConnections, setTiktokConnections] = useState<Connection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [connectionName, setConnectionName] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);

  // Fetch connections
  useEffect(() => {
    const metaRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', 'meta', 'connections');
    const tiktokRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', 'tiktok', 'connections');
    
    const unsubMeta = onSnapshot(metaRef, (snapshot) => {
      setMetaConnections(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Connection)));
    });

    const unsubTiktok = onSnapshot(tiktokRef, (snapshot) => {
      setTiktokConnections(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Connection)));
      setIsLoading(false);
    });

    return () => { unsubMeta(); unsubTiktok(); };
  }, []);

  // Fetch products
  useEffect(() => {
    const productsRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      setProductsList(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Product)));
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setConnectionName('');
    setPixelId('');
    setAccessToken('');
    setTestEventCode('');
    setSelectedProducts([]);
    setEditingId(null);
  };

  const handleEditClick = (conn: Connection) => {
    setConnectionName(conn.name || '');
    setPixelId(conn.pixelId || '');
    setAccessToken(conn.accessToken || '');
    setTestEventCode(conn.testEventCode || '');
    setSelectedProducts(conn.linkedProducts || []);
    setEditingId(conn.id);
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذا الربط؟')) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', activeTab, 'connections', id));
      if (editingId === id) resetForm();
    } catch (error) {
      console.error("Error deleting connection:", error);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionName || !pixelId) {
      alert('يرجى ملء اسم الربط ورقم البكسل (Pixel ID)');
      return;
    }
    const connectionData = {
      name: connectionName,
      pixelId,
      accessToken,
      testEventCode,
      linkedProducts: selectedProducts,
      updatedAt: new Date().toISOString()
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', activeTab, 'connections', editingId), connectionData);
      } else {
        await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', activeTab, 'connections'), {
          ...connectionData,
          createdAt: new Date().toISOString()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving connection:", error);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const currentConnections = activeTab === 'meta' ? metaConnections : tiktokConnections;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>بكسل المنصات</h1>
          <p className={styles.subtitle}>أدر بكسلات التتبع الخاصة بك واربطها بالمنتجات بسهولة لتسجيل المبيعات</p>
        </div>
      </header>

      <div className={styles.platformTabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'meta' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('meta'); resetForm(); }}
        >
          <span className={styles.tabIcon}>🔵</span> بكسل ميتا (فيسبوك)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'tiktok' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('tiktok'); resetForm(); }}
        >
          <span className={styles.tabIcon}>🎵</span> بكسل تيك توك
        </button>
      </div>

      <div className={styles.contentGrid}>
        {/* Form Section */}
        <div className={styles.formSection}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>
              {editingId ? `تعديل ربط (${activeTab === 'meta' ? 'ميتا' : 'تيك توك'})` : `ربط جديد (${activeTab === 'meta' ? 'ميتا' : 'تيك توك'})`}
            </h2>
            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.formGroup}>
                <label>اسم الربط (لتمييز البكسل)</label>
                <input type="text" value={connectionName} onChange={e => setConnectionName(e.target.value)} placeholder="مثال: بكسل المتجر الرئيسي" required />
              </div>

              <div className={styles.formGroup}>
                <label>Pixel ID (مطلوب)</label>
                <input type="text" value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="مثال: 1234567890" required />
              </div>

              <div className={styles.formGroup}>
                <label>Access Token (Conversions API / Events API)</label>
                <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="قم بلصق الرمز السري الطويل هنا" rows={4} />
                <small>مطلوب لإرسال أحداث الشراء من السيرفر مباشرة لضمان الدقة العالية</small>
              </div>

              <div className={styles.formGroup}>
                <label>Test Event Code (اختياري)</label>
                <input type="text" value={testEventCode} onChange={e => setTestEventCode(e.target.value)} placeholder="مثال: TEST12345" />
                <small>استخدمه لتجربة الإرسال والتأكد من وصول الأحداث في منصة الاختبار</small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.productsLabel}>
                  <span>الأصناف المربوطة بهذا البكسل</span>
                  <span className={styles.countBadge}>{selectedProducts.length}</span>
                </label>
                <div className={styles.productsScrollList}>
                  {productsList.map(product => (
                    <div key={product.id} className={`${styles.productCheckItem} ${selectedProducts.includes(product.id) ? styles.selected : ''}`} onClick={() => handleProductToggle(product.id)}>
                      <div className={styles.checkCircle}>
                        {selectedProducts.includes(product.id) && <span>✓</span>}
                      </div>
                      <span>{product.name}</span>
                    </div>
                  ))}
                  {productsList.length === 0 && <p style={{textAlign: 'center', opacity: 0.5, padding: '1rem'}}>لا توجد أصناف مضافة بعد</p>}
                </div>
              </div>

              <div className={styles.formActions}>
                {editingId && <button type="button" className={styles.cancelBtn} onClick={resetForm}>إلغاء التعديل</button>}
                <button type="submit" className={styles.submitBtn}>
                  {editingId ? 'حفظ التغييرات' : 'إضافة البكسل'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className={styles.listSection}>
          <div className={styles.listHeader}>
            <h2>البكسلات المربوطة ({currentConnections.length})</h2>
          </div>
          
          <div className={styles.cardsGrid}>
            {isLoading ? (
              <p style={{textAlign: 'center', width: '100%', padding: '2rem'}}>جاري التحميل...</p>
            ) : currentConnections.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🔌</span>
                <p>لا يوجد أي بكسل مربوط حالياً في هذه المنصة</p>
              </div>
            ) : (
              currentConnections.map(conn => (
                <div key={conn.id} className={`${styles.pixelCard} ${editingId === conn.id ? styles.editingCard : ''}`} onClick={() => handleEditClick(conn)}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleArea}>
                      <span className={styles.platformBadge}>{activeTab === 'meta' ? 'Meta' : 'TikTok'}</span>
                      <h3>{conn.name}</h3>
                    </div>
                    <button className={styles.deleteBtn} onClick={(e) => handleDelete(conn.id, e)} title="حذف">🗑️</button>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>ID:</span>
                      <span className={styles.infoValue}>{conn.pixelId}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Token:</span>
                      <span className={styles.infoValue}>{conn.accessToken ? '••••••••تمت الإضافة' : 'غير متوفر'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>الأصناف المربوطة:</span>
                      <span className={styles.productsCount}>{conn.linkedProducts?.length || 0} أصناف</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
