"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query as fsQuery, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import styles from './page.module.css';

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  is_settled?: boolean;
  date: any;
}

export default function TreasurySettlementPage() {
  const [actualBalance, setActualBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    // Query all 'delivered' orders to calculate balances and show pending ones
    const q = fsQuery(
      collection(db, 'orders'),
      where('status', '==', 'delivered')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let actual = 0;
      let pending = 0;
      const pendingList: Order[] = [];

      snapshot.docs.forEach((document) => {
        const data = document.data();
        const amount = Number(data.totalAmount) || 0;
        
        // Treat undefined is_settled as false
        const isSettled = data.is_settled === true;

        if (isSettled) {
          actual += amount;
        } else {
          pending += amount;
          pendingList.push({
            id: document.id,
            customerName: data.customerName || 'بدون اسم',
            customerPhone: data.customerPhone || '',
            totalAmount: amount,
            status: data.status,
            is_settled: isSettled,
            date: data.date
          });
        }
      });

      // Sort pending list by date descending (newest first)
      pendingList.sort((a, b) => {
        const tA = a.date?.toMillis ? a.date.toMillis() : 0;
        const tB = b.date?.toMillis ? b.date.toMillis() : 0;
        return tB - tA;
      });

      setActualBalance(actual);
      setPendingBalance(pending);
      setPendingOrders(pendingList);
      
      // Remove any selected orders that are no longer pending
      setSelectedOrders((prev) => {
        const next = new Set(prev);
        for (const id of next) {
          if (!pendingList.find(o => o.id === id)) {
            next.delete(id);
          }
        }
        return next;
      });

    }, (error) => {
      console.error("Error fetching delivered orders:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (id: string, checked: boolean) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSettle = async () => {
    if (selectedOrders.size === 0) return;
    
    const confirmSettle = window.confirm(`هل أنت متأكد من تسوية مبلغ ${selectedOrders.size} طلب/طلبات؟`);
    if (!confirmSettle) return;

    setIsSettling(true);
    try {
      const batch = writeBatch(db);
      
      selectedOrders.forEach(orderId => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { is_settled: true });
      });

      await batch.commit();
      
      // Selection will automatically clear via the onSnapshot effect, but we can clear it here too
      setSelectedOrders(new Set());
      alert('تمت التسوية بنجاح!');
    } catch (error) {
      console.error("Error during settlement:", error);
      alert('حدث خطأ أثناء التسوية. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>الخزنة المالية (تسوية الطلبات)</h1>
      </div>

      {/* Cards Section */}
      <div className={styles.cardsContainer}>
        <div className={`${styles.card} ${styles.actualCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>الرصيد الفعلي (القاصة)</div>
            <div className={`${styles.cardValue} ${styles.actualValue}`}>
              {actualBalance.toLocaleString()} د.ع
            </div>
          </div>
          <div className={styles.cardIcon}>💰</div>
        </div>

        <div className={`${styles.card} ${styles.pendingCard}`}>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>الرصيد المعلق (لدى المندوبين)</div>
            <div className={`${styles.cardValue} ${styles.pendingValue}`}>
              {pendingBalance.toLocaleString()} د.ع
            </div>
          </div>
          <div className={styles.cardIcon}>🚚</div>
        </div>
      </div>

      {/* Settlement Table Section */}
      <div className={styles.tableSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            الطلبات المعلقة ({pendingOrders.length})
          </div>
          <button 
            className={styles.settleButton} 
            onClick={handleSettle}
            disabled={selectedOrders.size === 0 || isSettling}
          >
            {isSettling ? (
              <span className={styles.loader}></span>
            ) : (
              <>
                <span className={styles.settleIcon}>✓</span>
                تأكيد استلام المبالغ (تسوية)
              </>
            )}
          </button>
        </div>

        <div className={styles.tableContainer}>
          {pendingOrders.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkboxCell}>
                    <input 
                      type="checkbox" 
                      className={styles.checkbox}
                      checked={selectedOrders.size === pendingOrders.length && pendingOrders.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>رقم الطلب</th>
                  <th>اسم الزبون</th>
                  <th>الهاتف</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(order => (
                  <tr key={order.id}>
                    <td className={styles.checkboxCell}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                      />
                    </td>
                    <td>{order.id}</td>
                    <td>{order.customerName}</td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>{order.customerPhone}</td>
                    <td className={styles.amountCol}>{order.totalAmount.toLocaleString()} د.ع</td>
                    <td className={styles.dateCol}>
                      {order.date?.toDate ? order.date.toDate().toLocaleDateString('ar-IQ') : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>✨</div>
              <div>لا توجد طلبات معلقة بانتظار التسوية!</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
