"use client";

import React, { useState } from 'react';
import styles from './page.module.css';

export default function Dashboard() {
  const [filter, setFilter] = useState('اليوم');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>لوحة القيادة</h1>
          <div className={styles.filters}>
            {['اليوم', 'هذا الأسبوع', 'هذا الشهر', 'هذا العام'].map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <div className={styles.datePicker}>
              <span>01 مارس 2026 - 31 مارس 2026</span>
            </div>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          {/* Card 1 */}
          <div className={`${styles.card} ${styles.colSpan2}`}>
            <div className={styles.cardHeader}>
              <span>إجمالي المبيعات</span>
            </div>
            <div className={styles.cardValue}>$24,500.00</div>
            <div className={`${styles.trend} ${styles.up}`}>
              <span>↑ 12%</span>
              <span style={{ color: 'var(--text-muted)' }}>مقارنة بالفترة السابقة</span>
            </div>
            <div className={styles.chartArea}>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressSuccess} style={{ width: '70%' }}></div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>الطلبات</span>
            </div>
            <div className={styles.cardValue}>1,240</div>
            <div className={`${styles.trend} ${styles.up}`}>
              <span>↑ 5%</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>المنتجات النشطة</span>
            </div>
            <div className={styles.cardValue}>842</div>
            <div className={`${styles.trend} ${styles.down}`}>
              <span>↓ 2%</span>
            </div>
          </div>

          {/* Team Performance */}
          <div className={`${styles.card} ${styles.colSpan2} ${styles.rowSpan2}`}>
            <div className={styles.cardHeader}>
              <span>أداء الفريق</span>
            </div>
            <div className={styles.empList}>
              <div className={styles.empRow}>
                <div className={styles.empAvatar}>
                  <div className={styles.empAvatarIcon}>أ</div>
                  أحمد يوسف
                </div>
                <div className={styles.empOrders}>142 طلب</div>
                <div className={styles.progressBarContainer} style={{ marginTop: 0 }}>
                  <div className={styles.progressSuccess} style={{ width: '85%' }}></div>
                </div>
              </div>
              <div className={styles.empRow}>
                <div className={styles.empAvatar}>
                  <div className={styles.empAvatarIcon}>ف</div>
                  فاطمة علي
                </div>
                <div className={styles.empOrders}>98 طلب</div>
                <div className={styles.progressBarContainer} style={{ marginTop: 0 }}>
                  <div className={styles.progressSuccess} style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className={styles.empRow}>
                <div className={styles.empAvatar}>
                  <div className={styles.empAvatarIcon}>م</div>
                  محمد كمال
                </div>
                <div className={styles.empOrders}>75 طلب</div>
                <div className={styles.progressBarContainer} style={{ marginTop: 0 }}>
                  <div className={styles.progressSuccess} style={{ width: '45%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Status */}
          <div className={`${styles.card} ${styles.colSpan2} ${styles.rowSpan2}`}>
            <div className={styles.cardHeader}>
              <span>حالة المخزون</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
              <div className={styles.donutContainer}>
                <div className={styles.donutText}>
                  <div className={styles.donutValue}>85%</div>
                  <div className={styles.donutLabel}>متوفر</div>
                </div>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-hover)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="314" strokeDashoffset="47" strokeLinecap="round" transform="rotate(-90 60 60)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}