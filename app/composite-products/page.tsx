"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';

interface RecipeItem {
  id: string; // unique generated id for the recipe row
  itemId: string; // the product id from firestore
  name: string;
  quantityNeeded: number;
}

export default function CompositeProductsPage() {
  // Data from Firestore
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [compositeProducts, setCompositeProducts] = useState<any[]>([]);

  // Form State - Final Product Details (Right Section)
  const [productDetails, setProductDetails] = useState({
    name: '',
    categoryId: '',
    subcategoryId: '',
    sellingPrice: 0,
    estimatedCost: 0,
    notes: ''
  });

  // Derived state for Subcategories
  const activeCategory = categories.find(c => c.id === productDetails.categoryId);
  const availableSubcategories = activeCategory ? activeCategory.subcategories : [];

  // Form State - Recipe Builder (Left Section)
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState<number | ''>('');

  // Toast Notification
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string, name: string }>({ 
    isOpen: false, 
    id: '', 
    name: '' 
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: null });
    }, 3000);
  };

  // Fetch Categories
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const processed = data.map((c: any) => ({
        ...c,
        subcategories: c.subcategories || []
      }));
      setCategories(processed);
    });
    return () => unsub();
  }, []);

  // Fetch Products (Raw Materials)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });
    return () => unsub();
  }, []);

  // Fetch Composite Products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'composite_products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setCompositeProducts(data);
    });
    return () => unsub();
  }, []);

  // Handle Adding Ingredient to Recipe
  const handleAddIngredient = () => {
    if (!selectedIngredientId) {
      alert("يرجى إختيار المادة الأولية");
      return;
    }
    if (!ingredientQuantity || ingredientQuantity <= 0) {
      alert("يرجى إدخال كمية صحيحة");
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedIngredientId);
    if (!selectedProduct) return;

    const newItem: RecipeItem = {
      id: Date.now().toString(),
      itemId: selectedProduct.id,
      name: selectedProduct.name,
      quantityNeeded: Number(ingredientQuantity)
    };

    setRecipeItems([...recipeItems, newItem]);
    
    // Reset inputs
    setSelectedIngredientId('');
    setIngredientQuantity('');
  };

  // Handle Removing Ingredient from Recipe
  const handleRemoveIngredient = (id: string) => {
    setRecipeItems(recipeItems.filter(item => item.id !== id));
  };

  // Handle Saving the Composite Product
  const handleSave = async () => {
    if (!productDetails.name) {
      alert("يرجى إدخال اسم المنتج التجميعي");
      return;
    }
    if (recipeItems.length === 0) {
      alert("يجب إضافة مادة أولية واحدة على الأقل في الوصفة");
      return;
    }

    try {
      // Calculate total cost accurately
      let totalCost = 0;
      recipeItems.forEach(item => {
        const prod = products.find(p => p.id === item.itemId);
        if (prod && prod.units && prod.units.length > 0) {
          const unitCost = prod.units[0].purchase || 0;
          totalCost += (unitCost * item.quantityNeeded);
        }
      });

      const payload = {
        name: productDetails.name,
        categoryId: productDetails.categoryId,
        subcategoryId: productDetails.subcategoryId,
        sellingPrice: productDetails.sellingPrice,
        cost: totalCost, // saving the explicitly calculated total cost
        notes: productDetails.notes,
        composition: recipeItems.map(item => ({
          itemId: item.itemId,
          name: item.name,
          quantityNeeded: item.quantityNeeded
        })),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'composite_products'), payload);
      
      showToast("تم إنشاء المنتج التجميعي بنجاح", "success");
      
      // Reset Form
      setProductDetails({
        name: '',
        categoryId: '',
        subcategoryId: '',
        sellingPrice: 0,
        estimatedCost: 0,
        notes: ''
      });
      setRecipeItems([]);

    } catch (e) {
      console.error("Error saving composite product:", e);
      showToast("حدث خطأ أثناء حفظ المنتج", "error");
    }
  };

  // Handle Deleting Composite Product
  const handleDeleteComposite = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'composite_products', deleteConfirm.id));
      showToast("تم الحذف بنجاح من قاعدة البيانات", "success");
      setDeleteConfirm({ isOpen: false, id: '', name: '' });
    } catch (e) {
      console.error("Error deleting composite product:", e);
      showToast("حدث خطأ أثناء الحذف", "error");
    }
  };

  // Pre-calculate Estimated Cost dynamically if cost per unit is known in products
  // Assuming the first unit purchase price is the base cost:
  useEffect(() => {
    let totalCost = 0;
    recipeItems.forEach(item => {
      const prod = products.find(p => p.id === item.itemId);
      if (prod && prod.units && prod.units.length > 0) {
        const unitCost = prod.units[0].purchase || 0;
        totalCost += (unitCost * item.quantityNeeded);
      }
    });
    setProductDetails(prev => ({ ...prev, estimatedCost: totalCost }));
  }, [recipeItems, products]);


  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.header}>
        <h1 className={styles.title}>المنتجات التجميعية (BOM)</h1>
        <button className={styles.addButton} onClick={handleSave}>
          حفظ المنتج التجميعي
        </button>
      </header>

      {/* Grid Layout: Split Screen */}
      <div className={styles.gridContainer}>
        
        {/* RIGHT SECTION: Final Product Details */}
        {/* Visually right, structurally first or second based on flex/grid order. HTML dir="rtl" naturally flows right-to-left.  */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>تفاصيل المنتج النهائي</h2>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>اسم المنتج التجميعي <span style={{color: 'red'}}>*</span></label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="مثال: بكج هدايا متنوع"
              value={productDetails.name}
              onChange={(e) => setProductDetails({...productDetails, name: e.target.value})}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>الفئة الرئيسية</label>
            <select 
              className={styles.select}
              value={productDetails.categoryId}
              onChange={(e) => setProductDetails({...productDetails, categoryId: e.target.value, subcategoryId: ''})}
            >
              <option value="" disabled hidden>إختر الفئة</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>الفئة الفرعية</label>
            <select 
              className={styles.select}
              value={productDetails.subcategoryId}
              onChange={(e) => setProductDetails({...productDetails, subcategoryId: e.target.value})}
              disabled={availableSubcategories.length === 0}
            >
              <option value="" disabled hidden>إختر الفئة الفرعية</option>
              {availableSubcategories.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>سعر البيع النهائي (د.ع)</label>
            <input 
              type="number" 
              className={styles.input} 
              value={productDetails.sellingPrice || ''}
              onChange={(e) => setProductDetails({...productDetails, sellingPrice: Number(e.target.value)})}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>التكلفة التقديرية التلقائية (د.ع)</label>
            <input 
              type="number" 
              className={styles.input} 
              value={productDetails.estimatedCost}
              disabled
              title="يتم حسابها تلقائياً من مجموع تكاليف المواد الأولية"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>ملاحظات</label>
            <textarea 
              className={styles.input} 
              rows={3}
              value={productDetails.notes}
              onChange={(e) => setProductDetails({...productDetails, notes: e.target.value})}
            />
          </div>

        </div>

        {/* LEFT SECTION: Recipe Builder (BOM) */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>منشئ الوصفة (المواد الأولية)</h2>
          
          <div className={styles.recipeInputRow}>
            <div className={styles.formGroup + " " + styles.recipeIngredientSelect}>
              <label className={styles.label}>المادة الأولية (اختر من الأصناف)</label>
              
              <input 
                list="ingredientsBrowser" 
                className={styles.input} 
                placeholder="ابحث واختر مادة أولية..."
                value={
                  selectedIngredientId 
                    ? products.find(p => p.id === selectedIngredientId)?.name || '' 
                    : ''
                }
                onChange={(e) => {
                  // Find product by name since datalist input value is the name
                  const prod = products.find(p => p.name === e.target.value);
                  if (prod) {
                    setSelectedIngredientId(prod.id);
                  } else {
                    setSelectedIngredientId('');
                  }
                }}
              />
              <datalist id="ingredientsBrowser">
                {products.map(prod => (
                  <option key={prod.id} value={prod.name} />
                ))}
              </datalist>

            </div>

            <div className={styles.formGroup + " " + styles.recipeQuantityInput}>
              <label className={styles.label}>الكمية</label>
              <input 
                type="number" 
                className={styles.input} 
                placeholder="1"
                min="0.1"
                step="any"
                value={ingredientQuantity}
                onChange={(e) => setIngredientQuantity(e.target.value ? Number(e.target.value) : '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIngredient();
                  }
                }}
              />
            </div>

            <button className={styles.addIngredientBtn} onClick={handleAddIngredient} title="إضافة للوصفة">
              + أضف
            </button>
          </div>

          {/* Recipe Table */}
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم المادة الأولية</th>
                  <th>الكمية المطلوبة</th>
                  <th style={{ width: '60px' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {recipeItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      لم تقم بإضافة أي مواد أولية لهذه الوصفة بعد.
                    </td>
                  </tr>
                ) : (
                  recipeItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td>{item.quantityNeeded}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className={styles.deleteBtn} onClick={() => handleRemoveIngredient(item.id)} title="حذف">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* List of Existing Composite Products */}
      <div className={styles.section} style={{ marginTop: '2rem' }}>
        <h2 className={styles.sectionTitle}>قائمة المنتجات التجميعية</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المنتج التجميعي</th>
                <th>سعر البيع</th>
                <th>التكلفة</th>
                <th>عدد المواد الأولية</th>
                <th style={{ width: '80px', textAlign: 'center' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {compositeProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                    لا توجد منتجات تجميعية مضافة حتى الآن.
                  </td>
                </tr>
              ) : (
                compositeProducts.map((cp, index) => (
                  <tr key={cp.id}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{cp.name}</td>
                    <td style={{ color: '#10B981', fontWeight: 'bold' }}>{cp.sellingPrice ? new Intl.NumberFormat('en-US').format(cp.sellingPrice) + ' د.ع' : '---'}</td>
                    <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{cp.cost ? new Intl.NumberFormat('en-US').format(cp.cost) + ' د.ع' : '0'}</td>
                    <td>{cp.composition?.length || 0} مواد</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteComposite(cp.id, cp.name)} title="حذف">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.type && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              تأكيد الحذف
            </div>
            <div className={styles.confirmModalBody}>
              هل أنت متأكد من رغبتك في حذف المنتج التجميعي <strong>({deleteConfirm.name})</strong>؟
              <br />
              <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                سيتم حذف هذا المنتج نهائياً من قاعدة البيانات.
              </span>
            </div>
            <div className={styles.confirmModalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
              >
                إلغاء
              </button>
              <button 
                className={styles.confirmDeleteBtn} 
                onClick={confirmDelete}
              >
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
