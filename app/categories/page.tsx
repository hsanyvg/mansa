"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

interface PageStore {
  id: string;
  name: string;
}

interface MainCategory {
  id: string;
  pageId: string; // Relates to PageStore
  name: string;
}

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pagesStores, setPagesStores] = useState<PageStore[]>([]);
  const [categories, setCategories] = useState<MainCategory[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // Expanded states
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [expandedMainCatId, setExpandedMainCatId] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'addPage' | 'editPage' | 'addMain' | 'editMain' | 'addProduct'>('addPage');
  const [targetPageId, setTargetPageId] = useState<string | null>(null);
  const [targetMainId, setTargetMainId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');

  // Delete Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'page' | 'main'>('page');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, parentId?: string, grandParentId?: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubPages = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), (snapshot) => {
      const pData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PageStore[];
      setPagesStores(pData);
    });

    const unsubCats = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), (snapshot) => {
      const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MainCategory[];
      setCategories(catsData);
    });
    
    const unsubProducts = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => { unsubPages(); unsubCats(); unsubProducts(); };
  }, []);

  const getProductQuantity = (prod: any) => {
    if (prod.totalBaseQuantity !== undefined) return prod.totalBaseQuantity;
    let total = 0;
    if (prod.stock && prod.units && prod.units.length > 0) {
      Object.values(prod.stock).forEach((s: any) => {
        const uMul = prod.units.find((u: any) => u.type === s.unit)?.count || 1;
        total += (Number(s.quantity) || 0) * uMul;
      });
    }
    return total;
  };

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredPages = pagesStores.filter(p => (p.name || '').includes(searchTerm));

  // --- Handlers for Add/Edit Form ---
  const handleSave = () => {
    if (!inputName.trim()) return;

    const currentMode = modalMode;
    const currentName = inputName.trim();
    const currentTargetPageId = targetPageId;
    const currentTargetMainId = targetMainId;

    closeModal();

    (async () => {
      try {
        if (currentMode === 'addPage') {
          await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), { name: currentName, createdAt: serverTimestamp() });
          showToastMsg("تم إضافة البيج بنجاح");
        } else if (currentMode === 'editPage' && currentTargetPageId) {
          await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores', currentTargetPageId), { name: currentName });
          showToastMsg("تم التعديل بنجاح");
        } else if (currentMode === 'addMain' && currentTargetPageId) {
          await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), { name: currentName, pageId: currentTargetPageId });
          setExpandedPageId(currentTargetPageId);
          showToastMsg("تم إضافة الفئة الرئيسية بنجاح");
        } else if (currentMode === 'editMain' && currentTargetMainId) {
          await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories', currentTargetMainId), { name: currentName });
          showToastMsg("تم التعديل بنجاح");
        } else if (currentMode === 'addProduct' && currentTargetMainId) {
          await addDoc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), {
            name: currentName,
            categoryId: currentTargetMainId,
            barcode: "",
            model: "",
            trackingCode: "",
            notes: "",
            reorderLevel: 10,
            units: [
              { id: '1', name: 'وحدة صغرى', type: 'قطعة', count: 1, purchase: 0, selling: 0 }
            ],
            stock: {},
            totalBaseQuantity: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          showToastMsg("تم إضافة الصنف بنجاح");
        }
      } catch (error) {
        console.error("Error saving document: ", error);
        showToastMsg("حدث خطأ أثناء الحفظ", "error");
      }
    })();
  };

  // --- Open Modal Helpers ---
  const openAddPageModal = () => { setModalMode('addPage'); setInputName(''); setShowModal(true); };
  const openEditPageModal = (id: string, name: string) => { setModalMode('editPage'); setTargetPageId(id); setInputName(name); setShowModal(true); };
  
  const openAddMainModal = (pageId: string) => { setModalMode('addMain'); setTargetPageId(pageId); setInputName(''); setShowModal(true); };
  const openEditMainModal = (id: string, name: string) => { setModalMode('editMain'); setTargetMainId(id); setInputName(name); setShowModal(true); };
  
  const openAddProductModal = (mainId: string) => { setModalMode('addProduct'); setTargetMainId(mainId); setInputName(''); setShowModal(true); };

  const closeModal = () => {
    setShowModal(false);
    setTargetPageId(null);
    setTargetMainId(null);
  };

  // --- Handlers for Delete ---
  const clickDeletePage = (id: string, name: string) => {
    setDeleteMode('page'); setItemToDelete({ id, name }); setShowDeleteModal(true);
  };
  const clickDeleteMain = (id: string, name: string) => {
    setDeleteMode('main'); setItemToDelete({ id, name }); setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (deleteMode === 'page') {
        const catsToDelete = categories.filter(c => c.pageId === itemToDelete.id);
        for (const cat of catsToDelete) {
          await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories', cat.id));
        }
        await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores', itemToDelete.id));
        if (expandedPageId === itemToDelete.id) setExpandedPageId(null);
        showToastMsg("تم حذف البيج بنجاح");
      } else if (deleteMode === 'main') {
        await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories', itemToDelete.id));
        if (expandedMainCatId === itemToDelete.id) setExpandedMainCatId(null);
        showToastMsg("تم حذف الفئة الرئيسية");
      }
    } catch (err) {
      console.error(err);
      showToastMsg("حدث خطأ أثناء الحذف", "error");
    }
    closeDeleteModal();
  };

  const closeDeleteModal = () => { setShowDeleteModal(false); setItemToDelete(null); };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>ادارة الفئات (البيجات والأصناف)</h1>
        <div className={styles.headerActions}>
          <button className={styles.addPageButton} onClick={openAddPageModal}>
            إضافة بيج/محل جديد (+)
          </button>
          <div className={styles.searchBox}>
            <input 
              type="text" 
              placeholder="بحث في البيجات..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>
        </div>
      </header>

      <main className={styles.pageGrid}>
        {filteredPages.map((page) => {
          const pageCategories = categories.filter(c => c.pageId === page.id);
          const isPageExpanded = expandedPageId === page.id;

          return (
            <div key={page.id} className={styles.pageCardWrapper}>
              {/* Level 1: Page Card */}
              <div 
                className={`${styles.pageCard} ${isPageExpanded ? styles.activePage : ''}`}
                onClick={() => setExpandedPageId(isPageExpanded ? null : page.id)}
              >
                <div className={styles.cardHeader}>
                  <h2 className={styles.pageTitle}>🏢 {page.name}</h2>
                  <div className={styles.pageStats}>
                    يشمل {pageCategories.length} فئات رئيسية
                  </div>
                </div>

                <div className={styles.cardActionsHover}>
                   <button onClick={(e) => { e.stopPropagation(); openEditPageModal(page.id, page.name); }} className={styles.iconBtn}>✏️</button>
                   <button onClick={(e) => { e.stopPropagation(); clickDeletePage(page.id, page.name); }} className={styles.iconBtnCancel}>🗑️</button>
                </div>
              </div>

              {/* Level 2: Main Categories Area */}
              {isPageExpanded && (
                <div className={styles.mainCatsContainer}>
                  <div className={styles.mainCatsHeader}>
                    <h3>الفئات الرئيسية لـ {page.name}</h3>
                    <button className={styles.addMainBtnSmall} onClick={() => openAddMainModal(page.id)}>
                      + إضافة فئة رئيسية
                    </button>
                  </div>
                  
                  <div className={styles.mainCatsGrid}>
                    {pageCategories.map(mainCat => {
                      const isMainExpanded = expandedMainCatId === mainCat.id;

                      return (
                        <div key={mainCat.id} className={styles.mainCatWrapper}>
                          <div 
                            className={`${styles.mainCatCard} ${isMainExpanded ? styles.activeMain : ''}`}
                            onClick={() => setExpandedMainCatId(isMainExpanded ? null : mainCat.id)}
                          >
                            <h4 className={styles.mainCatTitle}>{mainCat.name}</h4>
                            
                            <div className={styles.cardActionsHover}>
                               <button onClick={(e) => { e.stopPropagation(); openEditMainModal(mainCat.id, mainCat.name); }} className={styles.iconBtn}>✏️</button>
                               <button onClick={(e) => { e.stopPropagation(); clickDeleteMain(mainCat.id, mainCat.name); }} className={styles.iconBtnCancel}>🗑️</button>
                            </div>
                          </div>

                          {/* Level 3: Main Cat Items */}
                          {isMainExpanded && (
                            <div className={styles.subCatsContainer}>
                              {/* Show items directly under Main Category */}
                              {(() => {
                                const directProducts = products.filter(p => p.categoryId === mainCat.id);
                                return (
                                  <div style={{ marginBottom: '1rem', background: 'var(--surface)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <h5 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>أصناف في {mainCat.name}</h5>
                                    {directProducts.length > 0 ? (
                                      <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                                        <tbody>
                                          {directProducts.map(prod => (
                                             <tr key={prod.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                               <td style={{ padding: '0.4rem', color: 'var(--text-main)' }}>{prod.name}</td>
                                               <td style={{ padding: '0.4rem', textAlign: 'left', color: '#10b981', fontWeight: 'bold' }}>الكمية: {getProductQuantity(prod)}</td>
                                             </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0', marginBottom: '1rem' }}>لا توجد أصناف في هذه الفئة.</div>
                                    )}
                                    <button 
                                      className={styles.addProductBtnSmall}
                                      onClick={(e) => { e.stopPropagation(); openAddProductModal(mainCat.id); }}
                                    >
                                      ➕ إضافة صنف في هذه الفئة
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {pageCategories.length === 0 && (
                      <div className={styles.emptyState}>لا توجد فئات رئيسية. أضف فئة لتبدأ.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredPages.length === 0 && (
          <div className={styles.emptyState}>لم يتم العثور على بيجات/محلات.</div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modalMode === 'addPage' ? 'إضافة بيج/محل جديد' :
                 modalMode === 'editPage' ? 'تعديل البيج/المحل' :
                 modalMode === 'addMain' ? 'إضافة فئة رئيسية' :
                 modalMode === 'editMain' ? 'تعديل الفئة الرئيسية' :
                 modalMode === 'addProduct' ? 'إضافة صنف جديد (منتج)' : ''}
              </h2>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>الاسم</label>
                <input 
                  type="text" 
                  className={styles.input}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="submit" className={styles.saveButton}>حفظ</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.deleteModal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: '#ef4444' }}>تأكيد الحذف</h2>
              <button className={styles.closeButton} onClick={closeDeleteModal}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '2rem', textAlign: 'center', fontSize: '1.2rem', color: 'var(--text-main)' }}>
              هل أنت متأكد من حذف 
              {deleteMode === 'page' ? ' البيج/المحل' : ' الفئة الرئيسية'} 
              <strong> "{itemToDelete?.name}"</strong>؟ <br/>
              {deleteMode === 'page' && <span style={{color: '#f87171', fontSize: '0.9rem', display: 'block', marginTop: '1rem'}}>تنبيه: سيتم حذف جميع الفئات المرتبطة بهذا البيج!</span>}
            </div>
            <div className={styles.modalFooter} style={{ justifyContent: 'center', gap: '1rem' }}>
              <button className={styles.saveButton} style={{ backgroundColor: '#ef4444', border: 'none' }} onClick={confirmDelete}>نعم، احذف</button>
              <button className={styles.saveButton} style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-main)' }} onClick={closeDeleteModal}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
