"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import Link from 'next/link';

import { db } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import CurrencyInput from '../../components/CurrencyInput';
import Barcode from 'react-barcode';
import { calculateTotalBaseQuantity, formatDisplayQuantity, getInventoryBalances } from '../../lib/inventoryUtils';

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesLength, setEntriesLength] = useState(25);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{id: string, name: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'prices' | 'stores' | 'notes'>('basic');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  // Barcode specific state
  const [inlineBarcodeEditingId, setInlineBarcodeEditingId] = useState<string | null>(null);
  const [inlineBarcodeValue, setInlineBarcodeValue] = useState('');
  const [printModalProduct, setPrintModalProduct] = useState<any | null>(null);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: null });
    }, 3000);
  };

  const [categoriesDb, setCategoriesDb] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedMainCat, setSelectedMainCat] = useState('');
  const [selectedSubCat, setSelectedSubCat] = useState('');
  const [filterMainCat, setFilterMainCat] = useState('');
  const [filterSubCat, setFilterSubCat] = useState('');
  
  const [availableUnits, setAvailableUnits] = useState<{id: string, name: string}[]>([]);
  const [storesDb, setStoresDb] = useState<any[]>([]);
  const [pagesStoresDb, setPagesStoresDb] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productStock, setProductStock] = useState<Record<string, { quantity: number, unit: string }>>({});

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    reorderLevel: 10,
    barcode: '97X1NBrPq8q',
    model: '',
    notes: ''
  });

  const [units, setUnits] = useState([
    { id: '1', name: 'وحدة صغرى', type: 'قطعة', count: 1, purchase: 0, selling: 0 },
    { id: '2', name: 'وحدة متوسطة', type: 'علبة', count: 0, purchase: 0, selling: 0 },
    { id: '3', name: 'وحدة كبرى', type: 'كرتونة', count: 0, purchase: 0, selling: 0 }
  ]);

  const addUnit = () => {
    setUnits([
      ...units, 
      { id: Date.now().toString(), name: `وحدة جديدة`, type: 'قطعة', count: 0, purchase: 0, selling: 0 }
    ]);
  };

  const removeUnit = (id: string) => {
    setUnits(units.filter(u => u.id !== id));
  };

  const updateUnit = (id: string, field: string, value: any) => {
    setUnits(units.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const [isAutoCalculate, setIsAutoCalculate] = useState(true);

  const handlePriceChange = (unitId: string, newValueStr: string | number, priceType: 'purchase' | 'selling') => {
    let newPrice = typeof newValueStr === 'string' ? parseFloat(newValueStr) : Number(newValueStr);
    if (isNaN(newPrice) || newPrice < 0) {
      newPrice = 0;
    }
    
    const index = units.findIndex(u => u.id === unitId);
    if (index === -1) return;

    if (!isAutoCalculate) {
      updateUnit(unitId, priceType, newPrice);
      return;
    }

    let basePrice = newPrice;
    for (let j = index; j > 0; j--) {
      const multiplier = Number(units[j].count) || 1; 
      basePrice = basePrice / multiplier;
    }

    const newUnits = [...units];
    let currentPrice = basePrice;
    newUnits[0] = { ...newUnits[0], [priceType]: currentPrice };

    for (let j = 1; j < newUnits.length; j++) {
      currentPrice = currentPrice * (Number(newUnits[j].count) || 1);
      newUnits[j] = { ...newUnits[j], [priceType]: currentPrice };
    }

    setUnits(newUnits);
  };

  // Fetch real categories from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const catsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const processed = catsData.map((c: any) => ({
        ...c,
        subcategories: c.subcategories || []
      }));
      setCategoriesDb(processed);
    });
    return () => unsub();
  }, []);

  // Handle auto-selection for the Add Product modal
  useEffect(() => {
    if (pagesStoresDb.length > 0 && !selectedPage && !editingProductId) {
      setSelectedPage(''); // Don't auto-select to force them to choose.
    }
  }, [pagesStoresDb, selectedPage, editingProductId]);

  // Fetch pages_stores from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pages_stores'), (snapshot) => {
      setPagesStoresDb(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsub();
  }, []);

  // Fetch real units from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'units'), (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setAvailableUnits(uData);
    });
    return () => unsub();
  }, []);

  // Fetch products from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      pData.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setProducts(pData);
    });
    return () => unsub();
  }, []);

  // Fetch stores from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const sData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setStoresDb(sData);
    });
    return () => unsub();
  }, []);

  const handlePageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPage(e.target.value);
    setSelectedMainCat('');
    setSelectedSubCat('');
  };

  const handleMainCatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mainId = e.target.value;
    setSelectedMainCat(mainId);
    setSelectedSubCat('');
  };

  const activeMainCatObj = categoriesDb.find(c => c.id === selectedMainCat);
  const availableSubCats = activeMainCatObj ? activeMainCatObj.subcategories : [];

  const filterMainCatObj = categoriesDb.find(c => c.id === filterMainCat);
  const filterAvailableSubCats = filterMainCatObj ? filterMainCatObj.subcategories : [];

  const handleEditProduct = (prod: any) => {
    setEditingProductId(prod.id);
    setFormData({
      name: prod.name || '',
      reorderLevel: prod.reorderLevel || 10,
      barcode: prod.barcode || '',
      model: prod.model || '',
      notes: prod.notes || ''
    });
    
    const catObj = categoriesDb.find(c => c.id === prod.categoryId);
    setSelectedPage(catObj ? catObj.pageId : '');
    setSelectedMainCat(prod.categoryId || '');
    setSelectedSubCat(prod.subcategoryId || '');
    if (prod.units && prod.units.length > 0) {
      setUnits(prod.units);
    } else {
      setUnits([
        { id: '1', name: 'وحدة صغرى', type: 'قطعة', count: 1, purchase: 0, selling: 0 }
      ]);
    }
    setProductStock(prod.stock || {});
    setActiveTab('basic');
    setShowAddModal(true);
  };

  const handleDeleteProduct = (prod: any) => {
    setProductToDelete({ id: prod.id, name: prod.name });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      showToast("تم حذف الصنف بنجاح", "success");
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (e) {
      console.error("Error deleting product", e);
      showToast("حدث خطأ أثناء الحذف", "error");
    }
  };

  const handleSaveProduct = async () => {
    try {
      if (!formData.name) {
        alert("يرجى إدخال اسم الصنف");
        return;
      }
      if (!selectedPage) {
        alert("يرجى إختيار البيج");
        return;
      }
      if (!selectedMainCat) {
        alert("يرجى إختيار فئة رئيسية");
        return;
      }

      const warehousesArray = Object.values(productStock).map((s: any) => ({
        quantity: s.quantity,
        selectedUnit: s.unit
      }));
      const mappedUnitsForUtils = units.map((u: any) => ({
        name: u.type,
        multiplier: Number(u.count) || 1
      }));
      const totalBaseQuantity = calculateTotalBaseQuantity(warehousesArray, mappedUnitsForUtils);

      const productPayload = {
        ...formData,
        categoryId: selectedMainCat,
        subcategoryId: selectedSubCat,
        units: units,
        stock: productStock,
        totalBaseQuantity: totalBaseQuantity,
        updatedAt: serverTimestamp()
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productPayload);
        showToast("تم تعديل الصنف بنجاح!", "success");
      } else {
        await addDoc(collection(db, 'products'), {
          ...productPayload,
          createdAt: serverTimestamp()
        });
        showToast("تم إضافة الصنف بنجاح!", "success");
      }

      setShowAddModal(false);
      // Reset form
      setFormData({ name: '', reorderLevel: 10, barcode: '', model: '', notes: '' });
      setEditingProductId(null);
      setUnits([
        { id: '1', name: 'وحدة صغرى', type: 'قطعة', count: 1, purchase: 0, selling: 0 },
        { id: '2', name: 'وحدة متوسطة', type: 'علبة', count: 0, purchase: 0, selling: 0 },
        { id: '3', name: 'وحدة كبرى', type: 'كرتونة', count: 0, purchase: 0, selling: 0 }
      ]);
      setSelectedPage('');
      setSelectedMainCat('');
      setSelectedSubCat('');
      setProductStock({});
    } catch (e) {
      console.error("Error saving product: ", e);
      showToast("حدث خطأ أثناء حفظ الصنف", "error");
    }
  };

  const saveInlineBarcode = async (prodId: string) => {
    if (!inlineBarcodeEditingId) return; // Prevent double firing
    const valueToSave = inlineBarcodeValue.trim();
    setInlineBarcodeEditingId(null); // Instantly close UI for responsiveness 

    if (!valueToSave) return; // Don't save empty string

    try {
      await updateDoc(doc(db, 'products', prodId), { barcode: valueToSave });
      showToast("تم حفظ الباركود بنجاح", "success");
    } catch (err) {
      console.error("Error updating barcode: ", err);
      showToast("حدث خطأ أثناء حفظ الباركود", "error");
    }
  };

  const handleInlineBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, prodId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveInlineBarcode(prodId);
    } else if (e.key === 'Escape') {
      setInlineBarcodeEditingId(null);
    }
  };

  const generateRandomBarcode = () => {
    // Generates a 12 digit string resembling a UPC/EAN barcode
    return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
  };

  const handlePrintBarcode = async (prod: any) => {
    let currentBarcode = prod.barcode;
    if (!currentBarcode) {
      currentBarcode = generateRandomBarcode();
      try {
        await updateDoc(doc(db, 'products', prod.id), { barcode: currentBarcode });
        showToast("تم توليد الباركود بنجاح", "success");
      } catch (err) {
        console.error("Error generating barcode: ", err);
        showToast("حدث خطأ أثناء توليد الباركود", "error");
        return;
      }
    }
    setPrintModalProduct({ ...prod, barcode: currentBarcode });
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.header}>
        <h1 className={styles.title}>قائمة الأصناف</h1>
        <button className={styles.addButton} onClick={() => {
          setEditingProductId(null);
          setFormData({ name: '', reorderLevel: 10, barcode: '', model: '', notes: '' });
          setUnits([
            { id: '1', name: 'وحدة صغرى', type: 'قطعة', count: 1, purchase: 0, selling: 0 },
            { id: '2', name: 'وحدة متوسطة', type: 'علبة', count: 0, purchase: 0, selling: 0 },
            { id: '3', name: 'وحدة كبرى', type: 'كرتونة', count: 0, purchase: 0, selling: 0 }
          ]);
          setSelectedPage('');
          setSelectedMainCat('');
          setSelectedSubCat('');
          setProductStock({});
          setShowAddModal(true);
        }}>
          <span>+ إضافة</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main>
        {/* Top Filters (matching screenshot: 3 columns) */}
        <div className={styles.filtersSection}>
          <select 
            className={styles.filterSelect} 
            value={filterMainCat}
            onChange={(e) => {
              setFilterMainCat(e.target.value);
              setFilterSubCat('');
            }}
          >
            <option value="">كل الفئات الرئيسية</option>
            {pagesStoresDb.map(page => {
              const pageCats = categoriesDb.filter(c => c.pageId === page.id);
              if (pageCats.length === 0) return null;
              return (
                <optgroup key={page.id} label={page.name}>
                  {pageCats.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <select 
            className={styles.filterSelect} 
            value={filterSubCat}
            onChange={(e) => setFilterSubCat(e.target.value)}
          >
            <option value="">كل الفئات الفرعية</option>
            {filterAvailableSubCats.map((sub: any) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>

          <button className={styles.searchButton}>
            بحث
          </button>
        </div>

        {/* Table Controls (matching screenshot: Excel, Print, Length, Search) */}
        <div className={styles.tableControls}>
          <div className={styles.actionsLeft}>
            <button className={styles.actionButton}>طباعة</button>
            <button className={styles.actionButton}>تحميل إكسيل</button>
          </div>

          <div className={styles.controlsRight}>
            <div className={styles.lengthControl}>
              <span>أظهر</span>
              <select 
                className={styles.lengthSelect}
                value={entriesLength}
                onChange={(e) => setEntriesLength(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>مدخلات</span>
            </div>

            <div className={styles.searchControl}>
              <span>إبحث:</span>
              <input 
                type="text" 
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>الصنف</th>
                <th>الباركود</th>
                <th>فئة رئيسية</th>
                <th>فئة فرعية</th>
                <th>التكلفة</th>
                <th>البيع</th>
                <th>الكمية</th>
                <th>قيمة المخزون</th>
                <th>العملية</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = products.filter(prod => {
                  const matchesSearch = prod.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        prod.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        prod.model?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesMainCat = filterMainCat ? prod.categoryId === filterMainCat : true;
                  const matchesSubCat = filterSubCat ? prod.subcategoryId === filterSubCat : true;
                  return matchesSearch && matchesMainCat && matchesSubCat;
                });

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {products.length === 0 ? "لا توجد بيانات متاحة في الجدول" : "لا توجد نتائج تطابق البحث"}
                      </td>
                    </tr>
                  );
                }

                return filtered.map((prod, index) => {
                  const mainCat = categoriesDb.find(c => c.id === prod.categoryId);
                  const subCat = mainCat?.subcategories?.find((s: any) => s.id === prod.subcategoryId);
                  const firstUnit = prod.units && prod.units.length > 0 ? prod.units[0] : null;

                  return (
                    <tr key={prod.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 'bold' }}>{prod.name}</td>
                      <td>
                        {inlineBarcodeEditingId === prod.id ? (
                          <input 
                            type="text" 
                            className={styles.barcodeInlineInput} 
                            value={inlineBarcodeValue}
                            onChange={(e) => setInlineBarcodeValue(e.target.value)}
                            onKeyDown={(e) => handleInlineBarcodeKeyDown(e, prod.id)}
                            onBlur={() => saveInlineBarcode(prod.id)}
                            autoFocus
                            placeholder="امسح الباركود..."
                          />
                        ) : (
                          prod.barcode ? (
                            <span className={styles.barcodeText} onClick={() => {
                              setInlineBarcodeValue(prod.barcode);
                              setInlineBarcodeEditingId(prod.id);
                            }}>
                              {prod.barcode}
                            </span>
                          ) : (
                            <button className={styles.addBarcodeBtn} onClick={() => {
                              setInlineBarcodeValue('');
                              setInlineBarcodeEditingId(prod.id);
                            }}>
                              + إضافة
                            </button>
                          )
                        )}
                      </td>
                      <td>{mainCat ? mainCat.name : '---'}</td>
                      <td>{subCat ? subCat.name : '---'}</td>
                      <td>{firstUnit ? `${firstUnit.type} : ${new Intl.NumberFormat('en-US').format(firstUnit.purchase)}` : '---'}</td>
                      <td>{firstUnit ? `${firstUnit.type} : ${new Intl.NumberFormat('en-US').format(firstUnit.selling)}` : '---'}</td>
                      <td style={{ fontWeight: 'bold', direction: 'rtl', verticalAlign: 'middle' }}>
                        {(() => {
                          let totalQty = 0;
                          let mappedUnits: any[] = [];
                          
                          if (prod.totalBaseQuantity !== undefined && prod.units && prod.units.length > 0) {
                            totalQty = prod.totalBaseQuantity;
                            mappedUnits = prod.units.map((u: any) => ({
                              name: u.type,
                              multiplier: Number(u.count) || 1
                            }));
                          } else if (prod.stock && prod.units && prod.units.length > 0) {
                            Object.values(prod.stock).forEach((s: any) => {
                              const uMul = prod.units.find((u: any) => u.type === s.unit)?.count || 1;
                              totalQty += (Number(s.quantity) || 0) * uMul;
                            });
                            mappedUnits = prod.units.map((u: any) => ({
                              name: u.type,
                              multiplier: Number(u.count) || 1
                            }));
                          } else {
                            return <span style={{ color: '#14b8a6' }}>{firstUnit ? `1 ${firstUnit.type}` : '---'}</span>;
                          }

                          const balances = getInventoryBalances(totalQty, mappedUnits);
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                              {balances.map((balanceStr: string, idx: number) => (
                                <span 
                                  key={idx} 
                                  style={{
                                    fontSize: idx === 0 ? '0.95rem' : '0.85rem',
                                    color: idx === 0 ? '#14b8a6' : '#9ca3af',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {balanceStr}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ color: '#10B981', fontWeight: 'bold' }}>
                        {(() => {
                          let totalValue = 0;
                          if (prod.stock) {
                            Object.values(prod.stock).forEach((s: any) => {
                              const unitPrice = prod.units?.find((u: any) => u.type === s.unit)?.purchase || 0;
                              totalValue += (s.quantity || 0) * unitPrice;
                            });
                          }
                          return new Intl.NumberFormat('en-US').format(totalValue) + ' د.ع';
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => handlePrintBarcode(prod)} className={styles.actionButton} style={{ padding: '0.4rem 0.8rem', color: '#8b5cf6', border: '1px solid #8b5cf6', background: 'transparent' }} title="طباعة باركود">🖨️</button>
                          <button className={styles.actionButton} style={{ padding: '0.4rem 0.8rem', color: '#10B981', border: '1px solid #10B981', background: 'transparent' }} title="عرض">👁️</button>
                          <button onClick={() => handleDeleteProduct(prod)} className={styles.actionButton} style={{ padding: '0.4rem 0.8rem', color: '#ef4444', border: '1px solid #ef4444', background: 'transparent' }} title="حذف">🗑️</button>
                          <button onClick={() => handleEditProduct(prod)} className={styles.actionButton} style={{ padding: '0.4rem 0.8rem', color: '#3b82f6', border: '1px solid #3b82f6', background: 'transparent' }} title="تعديل">✏️</button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingProductId ? "تعديل" : "إضافة"} <span style={{color: 'var(--text-muted)', fontWeight: 'normal'}}>الصنف</span></h2>
              <button className={styles.closeButton} onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className={styles.modalTabs}>
              <button className={`${styles.tab} ${activeTab === 'basic' ? styles.activeTab : ''}`} onClick={() => setActiveTab('basic')}>البيانات الاساسية</button>
              <button className={`${styles.tab} ${activeTab === 'prices' ? styles.activeTab : ''}`} onClick={() => setActiveTab('prices')}>الاسعار والوحدات</button>
              <button className={`${styles.tab} ${activeTab === 'stores' ? styles.activeTab : ''}`} onClick={() => setActiveTab('stores')}>المخازن والكميات</button>
              <button className={`${styles.tab} ${activeTab === 'notes' ? styles.activeTab : ''}`} onClick={() => setActiveTab('notes')}>الملاحظات</button>
            </div>

            <div className={styles.modalBody}>
              {activeTab === 'basic' && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الإسم</label>
                    <input type="text" className={styles.input} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>حد الطلب</label>
                    <input type="number" className={styles.input} value={formData.reorderLevel} onChange={(e) => setFormData({...formData, reorderLevel: Number(e.target.value)})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>البيج</label>
                    <select className={styles.select} value={selectedPage} onChange={handlePageChange}>
                      <option value="" disabled hidden>إختر البيج</option>
                      {pagesStoresDb.map(page => (
                        <option key={page.id} value={page.id}>{page.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>فئة رئيسية</label>
                    <select className={styles.select} value={selectedMainCat} onChange={handleMainCatChange}>
                      <option value="" disabled hidden>إختر فئة رئيسية</option>
                      {categoriesDb.filter(c => c.pageId === selectedPage).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>فئة فرعية (إختياري)</label>
                    <select className={styles.select} value={selectedSubCat} onChange={(e) => setSelectedSubCat(e.target.value)}>
                      <option value="">بدون فئة فرعية</option>
                      {availableSubCats.map((sub: any) => (<option key={sub.id} value={sub.id}>{sub.name}</option>))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>باركود الأصناف</label>
                    <input type="text" className={styles.input} value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>الموديل</label>
                    <input type="text" className={styles.input} value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} />
                  </div>
                </div>
              )}

              {activeTab === 'prices' && (
                <div className={styles.pricesTab}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="autoCalcCheckbox" 
                      checked={isAutoCalculate}
                      onChange={(e) => setIsAutoCalculate(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', accentColor: '#10B981', cursor: 'pointer' }}
                    />
                    <label htmlFor="autoCalcCheckbox" style={{ fontWeight: 'bold', color: 'var(--text-color)', cursor: 'pointer', userSelect: 'none', fontSize: '1.1rem' }}>
                      حساب السعر اتوماتيك للوحدات المختلفة
                    </label>
                  </div>
                  <div className={styles.unitsGrid}>
                    <div className={styles.unitRow}>
                      <div className={styles.unitLabel}></div>
                      <div className={styles.unitColHeader}>العدد</div>
                      <div className={styles.unitColHeader}>سعر الشراء</div>
                      <div className={styles.unitColHeader}>سعر البيع</div>
                    </div>
                    {units.map((unit, index) => (
                      <div key={unit.id} className={styles.unitRow}>
                        <button className={styles.deleteUnitBtn} onClick={() => removeUnit(unit.id)}>✕</button>
                        <div className={styles.unitLabel}>
                          <input type="text" className={styles.input} value={unit.name} onChange={(e) => updateUnit(unit.id, 'name', e.target.value)} style={{ padding: '0.25rem', marginBottom: '0.25rem', fontWeight: 'bold' }} />
                          <select className={styles.select} value={unit.type} onChange={(e) => updateUnit(unit.id, 'type', e.target.value)}>
                            {availableUnits.map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}
                          </select>
                        </div>
                        <div className={styles.unitInputCol}>
                          <input 
                            type="number" 
                            min="0"
                            value={index === 0 ? 1 : (unit.count === 0 ? '' : unit.count)} 
                            disabled={index === 0}
                            title={index > 0 ? `عدد ما تحتويه من الوحدة ${units[index-1].type}` : ''}
                            onChange={(e) => {
                              let val = parseFloat(e.target.value);
                              if (isNaN(val) || val < 0) val = 0;
                              updateUnit(unit.id, 'count', val);
                            }} 
                            className={styles.input} 
                            style={index === 0 ? { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-muted)' } : undefined}
                          />
                        </div>
                        <div className={styles.unitInputCol}>
                          <CurrencyInput 
                            value={unit.purchase} 
                            onChangeValue={(val: any) => handlePriceChange(unit.id, val, 'purchase')} 
                            className={styles.input} 
                          />
                        </div>
                        <div className={styles.unitInputCol}>
                          <CurrencyInput 
                            value={unit.selling} 
                            onChangeValue={(val: any) => handlePriceChange(unit.id, val, 'selling')} 
                            className={styles.input} 
                          />
                        </div>
                      </div>
                    ))}
                    <div className={styles.addUnitContainer}><button className={styles.addUnitBtn} onClick={addUnit}>+ إضافة وحدة</button></div>
                  </div>
                </div>
              )}

              {activeTab === 'stores' && (
                <div className={styles.storesTab}>
                  {storesDb.map((store) => (
                    <div key={store.id} className={styles.storeRow}>
                      <div className={styles.quantCol}>
                        <select 
                          className={styles.quantSelect}
                          value={productStock[store.id]?.unit || units[0]?.type || ''}
                          onChange={(e) => setProductStock({
                            ...productStock,
                            [store.id]: { ...(productStock[store.id] || { quantity: 0 }), unit: e.target.value }
                          })}
                        >
                          {units.map(u => (<option key={u.id} value={u.type}>{u.type}</option>))}
                        </select>
                        <input 
                          type="number" 
                          className={styles.quantInput}
                          value={productStock[store.id]?.quantity || 0}
                          onChange={(e) => setProductStock({
                            ...productStock,
                            [store.id]: { ...(productStock[store.id] || { unit: units[0]?.type || '' }), quantity: Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div className={styles.storeInputCol}>
                        <input type="text" readOnly defaultValue={store.name} className={`${styles.input} ${styles.readOnlyInput}`} />
                      </div>
                    </div>
                  ))}
                  {storesDb.length === 0 && (<div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>يرجى إضافة مخزن أولاً.</div>)}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className={styles.notesTab}>
                  <textarea className={styles.textarea} rows={4} value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}></textarea>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.saveButton} onClick={handleSaveProduct}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}><h2 className={styles.confirmModalTitle}>تأكيد الحذف</h2></div>
            <div className={styles.confirmModalBody}><p>هل أنت متأكد من حذف الصنف <strong>({productToDelete?.name})</strong>؟</p></div>
            <div className={styles.confirmModalFooter}>
              <button className={styles.confirmDeleteBtn} onClick={handleConfirmDelete}>تأكيد الحذف</button>
              <button className={styles.cancelBtn} onClick={() => setShowDeleteModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Barcode Modal */}
      {printModalProduct && (
        <div className={`${styles.modalOverlay} ${styles.printModalOverlay}`}>
          <div className={styles.barcodePrintModal}>
            <div className={styles.printHeader}>
              <h2 className={styles.modalTitle}>طباعة الباركود</h2>
              <button className={styles.closeButton} onClick={() => setPrintModalProduct(null)}>×</button>
            </div>
            
            <div className={styles.printArea} id="print-area">
              <div className={styles.printSticker}>
                <div className={styles.stickerProductName}>{printModalProduct.name}</div>
                <Barcode 
                  value={printModalProduct.barcode} 
                  width={2} 
                  height={50} 
                  fontSize={14} 
                  background="transparent" 
                  lineColor="#000" 
                  margin={0}
                  displayValue={true}
                />
                {printModalProduct.units && printModalProduct.units.length > 0 && (
                  <div className={styles.stickerPrice}>
                    السعر: {new Intl.NumberFormat('en-US').format(printModalProduct.units[0].selling)} د.ع
                  </div>
                )}
              </div>
            </div>

            <div className={styles.printFooter}>
              <button 
                className={styles.saveButton} 
                onClick={() => {
                  const printContents = document.getElementById('print-area')?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  
                  if (printContents) {
                    document.body.innerHTML = printContents;
                    window.print();
                    document.body.innerHTML = originalContents;
                    window.location.reload(); // Reload to restore React bindings after print hack
                  }
                }}
              >
                🖨️ طباعة الآن
              </button>
              <button className={styles.cancelBtn} onClick={() => setPrintModalProduct(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast.type && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
