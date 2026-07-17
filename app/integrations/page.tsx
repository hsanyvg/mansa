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
  const [connectionsList, setConnectionsList] = useState<Connection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [connectionName, setConnectionName] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);

  // Fetch connections in real-time
  useEffect(() => {
    const connectionsRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', 'meta', 'connections');
    
    const unsubscribe = onSnapshot(connectionsRef, (snapshot) => {
      const connectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Connection[];
      
      setConnectionsList(connectionsData);
      setIsLoading(false);
    }, (error) => {
      console.error("خطأ في جلب الروابط:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch products
  useEffect(() => {
    const productsRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Product[];
      setProductsList(pData);
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
    e.stopPropagation(); // Prevent triggering the card click
    if (!window.confirm('هل أنت متأكد من حذف هذا الربط؟')) return;
    
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', 'meta', 'connections', id));
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionName.trim() || !pixelId.trim()) {
      alert("يرجى إدخال اسم الربط ورقم البيكسل على الأقل");
      return;
    }

    try {
      const connectionsRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'integrations', 'meta', 'connections');
      const dataToSave = {
        name: connectionName,
        pixelId,
        accessToken,
        testEventCode,
        linkedProducts: selectedProducts,
        updatedAt: new Date()
      };

      if (editingId) {
        // Update existing
        await updateDoc(doc(connectionsRef, editingId), dataToSave);
        alert("تم تحديث الإعدادات بنجاح");
      } else {
        // Add new
        await addDoc(connectionsRef, {
          ...dataToSave,
          createdAt: new Date()
        });
        alert("تمت إضافة الربط الجديد بنجاح");
      }
      
      resetForm();
    } catch (error) {
      console.error("خطأ في حفظ الإعدادات:", error);
      alert("حدث خطأ أثناء حفظ الإعدادات");
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>الربط والتتبع</h1>
      </header>

      <div className={styles.contentWrapper}>
        
        {/* Sidebar List */}
        <aside className={styles.listSidebar}>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>الروابط المحفوظة</h2>
            <button className={styles.addButton} onClick={resetForm}>
              + إضافة جديد
            </button>
          </div>
          
          <div className={styles.cardsContainer}>
            {isLoading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>جاري التحميل...</div>
            ) : connectionsList.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد روابط محفوظة بعد.</div>
            ) : (
              connectionsList.map((conn) => (
                <div 
                  key={conn.id} 
                  className={`${styles.connectionCard} ${editingId === conn.id ? styles.active : ''}`}
                  onClick={() => handleEditClick(conn)}
                >
                  <div className={styles.cardInfo}>
                    <span className={styles.cardTitle}>{conn.name || 'بدون اسم'}</span>
                    <span className={styles.cardSubtitle}>Pixel: {conn.pixelId}</span>
                  </div>
                  <button 
                    className={styles.deleteBtn} 
                    onClick={(e) => handleDelete(conn.id, e)}
                    title="حذف"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Form */}
        <main className={styles.formMain}>
          <div className={styles.formHeader}>
            <h2>{editingId ? `تعديل: ${connectionName}` : 'إضافة ربط جديد'}</h2>
          </div>
          
          <form onSubmit={handleSave}>
            <div className={styles.formGroup}>
              <label className={styles.label}>اسم الربط (Connection Name)</label>
              <input 
                type="text" 
                className={styles.input} 
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="مثال: متجر الملابس، صفحة العروض..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>رقم البيكسل (Pixel ID)</label>
              <input 
                type="text" 
                className={styles.input} 
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                placeholder="أدخل رقم البيكسل"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>رمز الوصول (Access Token) - للـ CAPI</label>
              <textarea 
                className={styles.input} 
                style={{ minHeight: '80px', direction: 'ltr', resize: 'vertical' }}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="أدخل رمز الوصول (Access Token) الخاص بالبيكسل"
              />
            </div>


            <div className={styles.formGroup}>
              <label className={styles.label}>كود اختبار الحدث (Test Event Code)</label>
              <input 
                type="text" 
                className={styles.input} 
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
                placeholder="أدخل كود اختبار الحدث"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>المنتجات المرتبطة بهذا البكسل</label>
              <div className={styles.productsListContainer}>
                {productsList.map(product => (
                  <label key={product.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                    />
                    <span className={styles.checkboxText}>{product.name}</span>
                  </label>
                ))}
                {productsList.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>جاري تحميل المنتجات...</div>
                )}
              </div>
            </div>

            <div className={styles.buttonContainer}>
              <button type="submit" className={styles.saveButton}>
                {editingId ? 'حفظ التعديلات' : 'إضافة الربط'}
              </button>
              {editingId && (
                <button type="button" className={styles.cancelButton} onClick={resetForm}>
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>
        </main>

      </div>
    </div>
  );
}
