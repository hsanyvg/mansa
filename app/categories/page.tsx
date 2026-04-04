"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

interface PageStore {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
}

interface MainCategory {
  id: string;
  pageId: string; // Relates to PageStore
  name: string;
  subcategories: SubCategory[];
}

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pagesStores, setPagesStores] = useState<PageStore[]>([]);
  const [categories, setCategories] = useState<MainCategory[]>([]);
  
  // Expanded states
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [expandedMainCatId, setExpandedMainCatId] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'addPage' | 'editPage' | 'addMain' | 'editMain' | 'addSub' | 'editSub'>('addPage');
  const [targetPageId, setTargetPageId] = useState<string | null>(null);
  const [targetMainId, setTargetMainId] = useState<string | null>(null);
  const [targetSubId, setTargetSubId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');

  // Delete Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'page' | 'main' | 'sub'>('page');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, parentId?: string, grandParentId?: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubPages = onSnapshot(collection(db, 'pages_stores'), (snapshot) => {
      const pData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PageStore[];
      setPagesStores(pData);
    });

    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MainCategory[];
      const processed = catsData.map(c => ({
        ...c,
        subcategories: c.subcategories || []
      }));
      setCategories(processed);
    });
    
    return () => { unsubPages(); unsubCats(); };
  }, []);

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredPages = pagesStores.filter(p => (p.name || '').includes(searchTerm));

  // --- Handlers for Add/Edit Form ---
  const handleSave = async () => {
    if (!inputName.trim()) return;

    try {
      if (modalMode === 'addPage') {
        await addDoc(collection(db, 'pages_stores'), { name: inputName, createdAt: serverTimestamp() });
        showToastMsg("تم إضافة البيج بنجاح");
      } else if (modalMode === 'editPage' && targetPageId) {
        await updateDoc(doc(db, 'pages_stores', targetPageId), { name: inputName });
        showToastMsg("تم التعديل بنجاح");
      } else if (modalMode === 'addMain' && targetPageId) {
        await addDoc(collection(db, 'categories'), { name: inputName, pageId: targetPageId, subcategories: [] });
        setExpandedPageId(targetPageId);
        showToastMsg("تم إضافة الفئة الرئيسية بنجاح");
      } else if (modalMode === 'editMain' && targetMainId) {
        await updateDoc(doc(db, 'categories', targetMainId), { name: inputName });
        showToastMsg("تم التعديل بنجاح");
      } else if (modalMode === 'addSub' && targetMainId) {
        const cat = categories.find(c => c.id === targetMainId);
        if (cat) {
          const newSubId = Date.now().toString();
          const subcategories = [...cat.subcategories, { id: newSubId, name: inputName }];
          await updateDoc(doc(db, 'categories', targetMainId), { subcategories });
          setExpandedMainCatId(targetMainId);
          showToastMsg("تم إضافة الفئة الفرعية بنجاح");
        }
      } else if (modalMode === 'editSub' && targetMainId && targetSubId) {
        const cat = categories.find(c => c.id === targetMainId);
        if (cat) {
          const subcategories = cat.subcategories.map(s => s.id === targetSubId ? { ...s, name: inputName } : s);
          await updateDoc(doc(db, 'categories', targetMainId), { subcategories });
          showToastMsg("تم التعديل بنجاح");
        }
      }
    } catch (error) {
      console.error("Error saving document: ", error);
      showToastMsg("حدث خطأ أثناء الحفظ", "error");
    }
    closeModal();
  };

  // --- Open Modal Helpers ---
  const openAddPageModal = () => { setModalMode('addPage'); setInputName(''); setShowModal(true); };
  const openEditPageModal = (id: string, name: string) => { setModalMode('editPage'); setTargetPageId(id); setInputName(name); setShowModal(true); };
  
  const openAddMainModal = (pageId: string) => { setModalMode('addMain'); setTargetPageId(pageId); setInputName(''); setShowModal(true); };
  const openEditMainModal = (id: string, name: string) => { setModalMode('editMain'); setTargetMainId(id); setInputName(name); setShowModal(true); };
  
  const openAddSubModal = (mainId: string) => { setModalMode('addSub'); setTargetMainId(mainId); setInputName(''); setShowModal(true); };
  const openEditSubModal = (mainId: string, subId: string, name: string) => { setModalMode('editSub'); setTargetMainId(mainId); setTargetSubId(subId); setInputName(name); setShowModal(true); };

  const closeModal = () => {
    setShowModal(false);
    setTargetPageId(null);
    setTargetMainId(null);
    setTargetSubId(null);
  };

  // --- Handlers for Delete ---
  const clickDeletePage = (id: string, name: string) => {
    setDeleteMode('page'); setItemToDelete({ id, name }); setShowDeleteModal(true);
  };
  const clickDeleteMain = (id: string, name: string) => {
    setDeleteMode('main'); setItemToDelete({ id, name }); setShowDeleteModal(true);
  };
  const clickDeleteSub = (mainId: string, subId: string, name: string) => {
    setDeleteMode('sub'); setItemToDelete({ id: subId, name, parentId: mainId }); setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (deleteMode === 'page') {
        const catsToDelete = categories.filter(c => c.pageId === itemToDelete.id);
        for (const cat of catsToDelete) {
          await deleteDoc(doc(db, 'categories', cat.id));
        }
        await deleteDoc(doc(db, 'pages_stores', itemToDelete.id));
        if (expandedPageId === itemToDelete.id) setExpandedPageId(null);
        showToastMsg("تم حذف البيج بنجاح");
      } else if (deleteMode === 'main') {
        await deleteDoc(doc(db, 'categories', itemToDelete.id));
        if (expandedMainCatId === itemToDelete.id) setExpandedMainCatId(null);
        showToastMsg("تم حذف الفئة الرئيسية");
      } else if (deleteMode === 'sub' && itemToDelete.parentId) {
        const cat = categories.find(c => c.id === itemToDelete.parentId);
        if (cat) {
          const subcategories = cat.subcategories.filter(s => s.id !== itemToDelete.id);
          await updateDoc(doc(db, 'categories', itemToDelete.parentId), { subcategories });
          showToastMsg("تم حذف الفئة الفرعية");
        }
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
                            <span className={styles.subCatCount}>{mainCat.subcategories.length} فروع</span>
                            
                            <div className={styles.cardActionsHover}>
                               <button onClick={(e) => { e.stopPropagation(); openEditMainModal(mainCat.id, mainCat.name); }} className={styles.iconBtn}>✏️</button>
                               <button onClick={(e) => { e.stopPropagation(); clickDeleteMain(mainCat.id, mainCat.name); }} className={styles.iconBtnCancel}>🗑️</button>
                            </div>
                          </div>

                          {/* Level 3: Sub Categories Area */}
                          {isMainExpanded && (
                            <div className={styles.subCatsContainer}>
                              <ul className={styles.subList}>
                                {mainCat.subcategories.map(subCat => (
                                  <li key={subCat.id} className={styles.subItem}>
                                    <span>↳ {subCat.name}</span>
                                    <div className={styles.subItemActions}>
                                      <button onClick={() => openEditSubModal(mainCat.id, subCat.id, subCat.name)} className={styles.textBtn}>تعديل</button>
                                      <button onClick={() => clickDeleteSub(mainCat.id, subCat.id, subCat.name)} className={styles.textBtnDelete}>حذف</button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              <button className={styles.addSubBtnSmall} onClick={() => openAddSubModal(mainCat.id)}>
                                + إضافة فئة فرعية
                              </button>
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
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modalMode === 'addPage' ? 'إضافة بيج/محل جديد' :
                 modalMode === 'editPage' ? 'تعديل البيج/المحل' :
                 modalMode === 'addMain' ? 'إضافة فئة رئيسية' :
                 modalMode === 'editMain' ? 'تعديل الفئة الرئيسية' :
                 modalMode === 'addSub' ? 'إضافة فئة فرعية' : 'تعديل الفئة الفرعية'}
              </h2>
              <button className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>الاسم</label>
                <input 
                  type="text" 
                  className={styles.input}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.saveButton} onClick={handleSave}>حفظ</button>
            </div>
          </div>
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
              {deleteMode === 'page' ? ' البيج/المحل' : deleteMode === 'main' ? ' الفئة الرئيسية' : ' الفئة الفرعية'} 
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
