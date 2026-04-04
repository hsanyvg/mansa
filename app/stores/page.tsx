"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

export default function StoresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesLength, setEntriesLength] = useState(25);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  const [storesData, setStoresData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });

  // Fetch Stores
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStoresData(data);
    });
    return () => unsub();
  }, []);

  // Fetch Products for calculation
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductsData(data);
    });
    return () => unsub();
  }, []);

  const handleSaveStore = async () => {
    if (!formData.name) {
      alert("يرجى إدخال اسم المخزن");
      return;
    }
    try {
      if (editingStoreId) {
        await updateDoc(doc(db, 'stores', editingStoreId), { ...formData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'stores'), { ...formData, createdAt: serverTimestamp() });
      }
      setShowAddModal(false);
      setFormData({ name: '', phone: '', notes: '' });
      setEditingStoreId(null);
    } catch (e) {
      console.error("Error saving store", e);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف ${name}؟\n(ملاحظة: حذف المخزن عملية لا يمكن التراجع عنها)`)) {
      try {
        await deleteDoc(doc(db, 'stores', id));
      } catch (e) {
        console.error("Error deleting store", e);
      }
    }
  };

  // Logic to calculate store value
  const getStoreValue = (storeId: string) => {
    let total = 0;
    productsData.forEach(prod => {
      if (prod.stock && prod.stock[storeId]) {
        const itemStock = prod.stock[storeId];
        const unitPriceObj = prod.units?.find((u: any) => u.type === itemStock.unit);
        if (unitPriceObj) {
          total += (itemStock.quantity || 0) * (unitPriceObj.purchase || 0);
        }
      }
    });
    return total;
  };

  // Logic for Details Modal Items
  const getStoreItems = (storeId: string) => {
    return productsData
      .filter(prod => prod.stock && prod.stock[storeId] && prod.stock[storeId].quantity > 0)
      .map(prod => {
        const itemStock = prod.stock[storeId];
        const unitPriceObj = prod.units?.find((u: any) => u.type === itemStock.unit);
        return {
          id: prod.id,
          item: prod.name,
          quantity: itemStock.quantity,
          unit: itemStock.unit,
          sellPrice: unitPriceObj?.selling || 0,
          total: (itemStock.quantity || 0) * (unitPriceObj?.purchase || 0)
        };
      });
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.header}>
        <h1 className={styles.title}>المخازن</h1>
        <button className={styles.addButton} onClick={() => {
          setEditingStoreId(null);
          setFormData({ name: '', phone: '', notes: '' });
          setShowAddModal(true);
        }}>
          + إضافة
        </button>
      </header>

      {/* Main Table Area */}
      <main className={styles.mainContent}>
        
        {/* Top Controls (Print, Excel, Entries, Search) */}
        <div className={styles.controlsHeader}>
          <div className={styles.actionButtons}>
            <button className={styles.actionBtn}>طباعة</button>
            <button className={styles.actionBtn}>تحميل إكسيل</button>
          </div>
          
          <div className={styles.tableFilters}>
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

        {/* The Data Table */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
               <tr>
                 <th style={{width: '60px'}}># <span className={styles.sortIcon}>▼▲</span></th>
                 <th>الإسم <span className={styles.sortIcon}>▼▲</span></th>
                 <th>التليفون <span className={styles.sortIcon}>▼▲</span></th>
                 <th>الملاحظات <span className={styles.sortIcon}>▼▲</span></th>
                 <th>قيمة المخزون <span className={styles.sortIcon}>▼▲</span></th>
                 <th style={{width: '300px'}}></th> {/* Column for actions */}
               </tr>
            </thead>
            <tbody>
              {storesData.filter(s => s.name?.includes(searchTerm)).map((row, index) => {
                const storeVal = getStoreValue(row.id);
                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.phone}</td>
                    <td>{row.notes}</td>
                    <td>
                      {storeVal > 0 ? (
                        <span className={styles.storeValueHighlight}>{new Intl.NumberFormat('en-US').format(storeVal)}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editBtn} onClick={() => {
                        setEditingStoreId(row.id);
                        setFormData({ name: row.name, phone: row.phone || '', notes: row.notes || '' });
                        setShowAddModal(true);
                      }}>
                        تعديل <span>✏️</span>
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(row.id, row.name)}
                      >
                        حذف <span>🗑️</span>
                      </button>
                      <button 
                        className={styles.detailsBtn}
                        onClick={() => {
                          setSelectedStore(row);
                          setShowDetailsModal(true);
                        }}
                      >
                        التفاصيل <span>👁️</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer (Pagination & Entry Info) */}
        <div className={styles.footerControls}>
          <div className={styles.pagination}>
            <button className={styles.pageBtn}>التالي</button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}>السابق</button>
          </div>
          <div>
            إظهار 1 إلى {storesData.length} من أصل {storesData.length} مدخل
          </div>
        </div>
      </main>

      {/* Details/Items Overlay Modal for a specific Store */}
      {showDetailsModal && selectedStore && (
        <div className={styles.modalOverlay}>
          <div className={styles.detailsModal}>
            <div className={styles.detailsModalHeader}>
              <h2 className={styles.detailsModalTitle}>التفاصيل - {selectedStore.name}</h2>
              <button 
                className={styles.detailsCloseBtn} 
                onClick={() => setShowDetailsModal(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.detailsModalBody}>
              {/* Controls inside Details Modal */}
              <div className={styles.controlsHeader}>
                <div className={styles.actionButtons}>
                  <button className={styles.actionBtn}>طباعة</button>
                  <button className={styles.actionBtn}>تحميل إكسيل</button>
                </div>
                
                <div className={styles.tableFilters}>
                  <div className={styles.lengthControl}>
                    <span>أظهر</span>
                    <select className={styles.lengthSelect} defaultValue={25}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span>مدخلات</span>
                  </div>
                  <div className={styles.searchControl}>
                    <span>إبحث:</span>
                    <input type="text" className={styles.searchInput} />
                  </div>
                </div>
              </div>

              {/* Data Table for Store Details */}
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{width: '60px'}}># <span className={styles.sortIcon}>▼▲</span></th>
                      <th>الصنف <span className={styles.sortIcon}>▼▲</span></th>
                      <th>الكمية <span className={styles.sortIcon}>▼▲</span></th>
                      <th>وحدة <span className={styles.sortIcon}>▼▲</span></th>
                      <th>البيع <span className={styles.sortIcon}>▼▲</span></th>
                      <th>الإجمالى <span className={styles.sortIcon}>▼▲</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {getStoreItems(selectedStore.id).map((row: any, index: number) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>{row.item}</td>
                        <td>{row.quantity}</td>
                        <td>{row.unit}</td>
                        <td>{new Intl.NumberFormat('en-US').format(row.sellPrice)}</td>
                        <td>{new Intl.NumberFormat('en-US').format(row.total)}</td>
                      </tr>
                    ))}
                    {/* The Total Row like in screenshot */}
                    <tr>
                      <td colSpan={5} style={{textAlign: 'left', fontWeight: 'bold'}}>الإجمالي:</td>
                      <td style={{fontWeight: 'bold'}}>{new Intl.NumberFormat('en-US').format(getStoreValue(selectedStore.id))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Inner Footer (Pagination) */}
              <div className={styles.footerControls}>
                <div className={styles.pagination}>
                  <button className={styles.pageBtn}>التالي</button>
                  <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
                  <button className={styles.pageBtn}>السابق</button>
                </div>
                <div>
                  إظهار 1 إلى {getStoreItems(selectedStore.id).length} من أصل {getStoreItems(selectedStore.id).length} مدخل
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Store Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.addStoreModal}>
            <div className={styles.detailsModalHeader}>
              <h2 className={styles.detailsModalTitle}>{editingStoreId ? 'تعديل مخزن' : 'إضافة مخزن جديد'}</h2>
              <button className={styles.detailsCloseBtn} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className={styles.detailsModalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>اسم المخزن</label>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    style={{ width: '100%' }}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>رقم الهاتف</label>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    style={{ width: '100%' }}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>ملاحظات</label>
                  <textarea 
                    className={styles.searchInput} 
                    style={{ width: '100%', minHeight: '80px', paddingTop: '0.5rem' }}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <button 
                  className={styles.addButton} 
                  style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                  onClick={handleSaveStore}
                >
                  {editingStoreId ? 'تحديث' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
