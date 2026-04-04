"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export default function UnitsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesLength, setEntriesLength] = useState(25);
  const [showModal, setShowModal] = useState(false);
  const [editUnit, setEditUnit] = useState<{ id: string, name: string } | null>(null);
  const [inputValue, setInputValue] = useState('');

  const [unitsData, setUnitsData] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'units'), (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as {id: string, name: string}[];
      setUnitsData(uData);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    try {
      if (editUnit) {
        await updateDoc(doc(db, 'units', editUnit.id), { name: inputValue });
      } else {
        if (inputValue.trim() !== '') {
          await addDoc(collection(db, 'units'), { name: inputValue });
        }
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'units', id));
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.header}>
        <h1 className={styles.title}>الوحدات</h1>
        <button 
          className={styles.addButton}
          onClick={() => {
            setEditUnit(null); // Clear any edit state for a new unit
            setInputValue('');
            setShowModal(true);
          }}
        >
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
                 <th style={{width: '200px'}}># <span className={styles.sortIcon}>▼▲</span></th>
                 <th>الإسم <span className={styles.sortIcon}>▼▲</span></th>
                 <th style={{width: '250px'}}></th> {/* Column for actions */}
               </tr>
            </thead>
            <tbody>
              {unitsData.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.name}</td>
                  <td className={styles.actionsCell}>
                    <button 
                      className={styles.editBtn}
                      onClick={() => {
                        setEditUnit(row); // Pass the current row data to the modal
                        setInputValue(row.name);
                        setShowModal(true);
                      }}
                    >
                      تعديل <span>✏️</span>
                    </button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(row.id)}
                    >
                      حذف <span>🗑️</span>
                    </button>
                  </td>
                </tr>
              ))}
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
            إظهار 1 إلى 6 من أصل 6 مدخل
          </div>
        </div>
      </main>

      {/* Add / Edit Unit Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editUnit ? `تعديل ${editUnit.name}` : 'إضافة وحدة جديدة'}
              </h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>الإسم</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.saveButton} onClick={handleSave}>حفظ</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
