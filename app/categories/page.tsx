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
  const [products, setProducts] = useState<any[]>([]);
  
  // Expanded states
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [expandedMainCatId, setExpandedMainCatId] = useState<string | null>(null);
  const [expandedSubCatId, setExpandedSubCatId] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'addPage' | 'editPage' | 'addMain' | 'editMain' | 'addSub' | 'editSub'>('addPage');
  const [targetPageId, setTargetPageId] = useState<string | null>(null);
  const [targetMainId, setTargetMainId] = useState<string | null>(null);
  const [targetSubId, setTargetSubId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  
  const [hasSubCategory, setHasSubCategory] = useState(false);
  const [inputSubName, setInputSubName] = useState('');

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
    
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
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
        let subs: SubCategory[] = [];
        if (hasSubCategory && inputSubName.trim()) {
          subs.push({ id: Date.now().toString(), name: inputSubName.trim() });
        }
        await addDoc(collection(db, 'categories'), { name: inputName, pageId: targetPageId, subcategories: subs });
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
  
  const openAddMainModal = (pageId: string) => { setModalMode('addMain'); setTargetPageId(pageId); setInputName(''); setHasSubCategory(false); setInputSubName(''); setShowModal(true); };
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

                          {/* Level 3: Sub Categories Area + Main Cat Items */}
                          {isMainExpanded && (
                            <div className={styles.subCatsContainer}>
                              {/* Show items directly under Main Category */}
                              {(() => {
                                const directProducts = products.filter(p => p.categoryId === mainCat.id && !p.subcategoryId);
                                if (directProducts.length > 0) {
                                  return (
                                    <div style={{ marginBottom: '1rem', background: 'var(--surface)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                      <h5 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>أصناف مباشرة في {mainCat.name}</h5>
                                      <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                        <tbody>
                                          {directProducts.map(prod => (
                                             <tr key={prod.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                               <td style={{ padding: '0.4rem', color: 'var(--text-main)' }}>{prod.name}</td>
                                               <td style={{ padding: '0.4rem', textAlign: 'left', color: '#10b981', fontWeight: 'bold' }}>الكمية: {getProductQuantity(prod)}</td>
                                             </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Show Sub Categories */}
                              <ul className={styles.subList}>
                                {mainCat.subcategories.map(subCat => {
                                  const isSubExpanded = expandedSubCatId === subCat.id;
                                  const subProducts = products.filter(p => p.subcategoryId === subCat.id);
                                  
                                  return (
                                    <li 
                                      key={subCat.id} 
                                      className={styles.subItem} 
                                      onClick={() => setExpandedSubCatId(isSubExpanded ? null : subCat.id)}
                                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span style={{ fontWeight: isSubExpanded ? 'bold' : 'normal', color: isSubExpanded ? 'var(--primary)' : 'inherit' }}>
                                          {isSubExpanded ? '▼' : '▶'} {subCat.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({subProducts.length} أصناف)</span>
                                        </span>
                                        <div className={styles.subItemActions}>
                                          <button onClick={(e) => { e.stopPropagation(); openEditSubModal(mainCat.id, subCat.id, subCat.name); }} className={styles.textBtn}>تعديل</button>
                                          <button onClick={(e) => { e.stopPropagation(); clickDeleteSub(mainCat.id, subCat.id, subCat.name); }} className={styles.textBtnDelete}>حذف</button>
                                        </div>
                                      </div>
                                      
                                      {isSubExpanded && (
                                        <div style={{ marginTop: '0.5rem', background: '#111827', padding: '0.5rem', borderRadius: '4px', border: '1px dashed #374151' }}>
                                          {subProducts.length === 0 ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0' }}>لا توجد أصناف في هذا الفرع.</div>
                                          ) : (
                                            <table style={{ width: '100%', fontSize: '0.9rem', color: 'var(--text-main)', borderCollapse: 'collapse' }}>
                                              <tbody>
                                                {subProducts.map(prod => (
                                                   <tr key={prod.id} style={{ borderBottom: '1px solid #1f2937' }}>
                                                     <td style={{ padding: '0.4rem', paddingLeft: '1rem' }}>{prod.name}</td>
                                                     <td style={{ padding: '0.4rem', textAlign: 'left', color: '#10b981', fontWeight: 'bold' }}>الكمية: {getProductQuantity(prod)}</td>
                                                   </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
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

              {modalMode === 'addMain' && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="hasSubCatCheck" 
                      checked={hasSubCategory} 
                      onChange={(e) => setHasSubCategory(e.target.checked)} 
                      style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <label htmlFor="hasSubCatCheck" style={{ cursor: 'pointer', color: 'var(--text-main)' }}>هل توجد فئة فرعية؟</label>
                  </div>
                  
                  {hasSubCategory && (
                    <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                      <label className={styles.label}>اسم الفئة الفرعية اليمنى لحفظها</label>
                      <input 
                        type="text" 
                        className={styles.input}
                        value={inputSubName}
                        onChange={(e) => setInputSubName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        placeholder="أدخل اسم الفئة الفرعية..."
                      />
                    </div>
                  )}
                </div>
              )}
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
