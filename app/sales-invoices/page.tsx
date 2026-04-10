"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import styles from './page.module.css';

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  useEffect(() => {
    // We fetch orders that are marked as 'delivered' (مكتمل)
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'delivered'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        let formattedDate = '---';
        if (data.date) {
           const d = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
           formattedDate = d.toLocaleDateString('en-GB');
        }
        return {
          id: doc.id,
          ...data,
          formattedDate
        };
      });
      setInvoices(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching invoices:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <span>📈</span> فواتير المبيعات
        </h1>
        <div className={styles.stats}>
          <span>عدد الحواتير: {invoices.length}</span>
        </div>
      </header>

      <div className={styles.tableSection}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>التاريخ</th>
              <th>الزبون</th>
              <th>الهاتف</th>
              <th>المحافظة</th>
              <th>الموظف المسؤول</th>
              <th>طريقة الدفع</th>
              <th>المبلغ</th>
              <th>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>جاري التحميل...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>لا توجد فواتير مكتملة حالياً.</td></tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={{ fontWeight: 'bold', color: '#a78bfa', fontSize: '0.8rem' }}>#{invoice.id.slice(-6).toUpperCase()}</td>
                  <td>{invoice.formattedDate}</td>
                  <td style={{ fontWeight: '600' }}>{invoice.customerName}</td>
                  <td style={{ direction: 'ltr', fontSize: '0.8rem' }}>{invoice.customerPhone || invoice.phone || '---'}</td>
                  <td>{invoice.governorate}</td>
                  <td style={{ color: '#60a5fa' }}>{invoice.employeeName || '---'}</td>
                  <td>{invoice.paymentMethod || 'كاش'}</td>
                  <td style={{ fontWeight: 'bold', color: '#10b981' }}>{new Intl.NumberFormat('en-US').format(invoice.totalAmount || 0)}</td>

                  <td>
                    <button 
                      className={styles.actionButton} 
                      onClick={() => setSelectedInvoice(invoice)}
                      title="عرض وطباعة"
                    >
                      🖨️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className={styles.modalOverlay} onClick={() => setSelectedInvoice(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className={styles.printButton} onClick={handlePrint}>
                  <span>🖨️</span> طباعة الفاتورة
                </button>
              </div>
              <h2 style={{ margin: 0 }}>معاينة الفاتورة</h2>
              <button className={styles.closeButton} onClick={() => setSelectedInvoice(null)}>×</button>
            </div>

            <div className={styles.invoiceBody}>
              <div className={styles.invoiceHeader}>
                <div className={styles.companyInfo}>
                  <h1>نظام إدارة المستودعات</h1>
                  <p>بغداد، العراق</p>
                  <p>هاتف: 077XXXXXXXX</p>
                </div>
                <div className={styles.invoiceMeta}>
                  <h2 style={{ color: '#000', marginBottom: '5px' }}>فاتورة مبيعات</h2>
                  <p><strong>رقم الطلب:</strong> {selectedInvoice.id.toUpperCase()}</p>
                  <p><strong>التاريخ:</strong> {selectedInvoice.formattedDate}</p>
                </div>
              </div>

              <div className={styles.customerSection}>
                <h3>معلومات الزبون</h3>
                <p><strong>الاسم:</strong> {selectedInvoice.customerName}</p>
                <p><strong>الهاتف:</strong> {selectedInvoice.customerPhone || selectedInvoice.phone || '---'}</p>
                <p><strong>العنوان:</strong> {selectedInvoice.governorate} - {selectedInvoice.region || ''}</p>
              </div>

              <table className={styles.invoiceTable}>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>المنتج</th>
                    <th style={{ width: '80px' }}>الكمية</th>
                    <th style={{ width: '120px' }}>السعر الفردي</th>
                    <th style={{ width: '120px' }}>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items || []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{new Intl.NumberFormat('en-US').format(item.price)} د.ع</td>
                      <td>{new Intl.NumberFormat('en-US').format(item.price * item.quantity)} د.ع</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.totalSection}>
                <div className={styles.totalBox}>
                  <div className={styles.totalRow}>
                    <span>المجموع الفرعي:</span>
                    <span>{new Intl.NumberFormat('en-US').format(selectedInvoice.totalAmount || 0)} د.ع</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>الضريبة (0%):</span>
                    <span>0 د.ع</span>
                  </div>
                  <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                    <span>الإجمالي الكلي:</span>
                    <span>{new Intl.NumberFormat('en-US').format(selectedInvoice.totalAmount || 0)} د.ع</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '50px', borderTop: '1px dashed #ccc', paddingTop: '20px', textAlign: 'center', color: '#777' }}>
                <p>شكراً لتعاملكم معنا!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
