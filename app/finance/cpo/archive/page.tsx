"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../../../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function CPOArchivePage() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation states: null = viewing months, 'YYYY-MM' = viewing days, 'YYYY-MM-DD' = viewing reports of a day
  const [currentView, setCurrentView] = useState<'months' | 'days' | 'reports'>('months');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports_archive'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Group by Month
  const months = Array.from(new Set(reports.map(r => r.month))).filter(Boolean);

  // Group by Day (for selected month)
  const daysInMonth = selectedMonth 
    ? Array.from(new Set(reports.filter(r => r.month === selectedMonth).map(r => r.day))).filter(Boolean)
    : [];

  // Reports for selected day
  const reportsInDay = selectedDay 
    ? reports.filter(r => r.day === selectedDay)
    : [];

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month);
    setCurrentView('days');
  };

  const handleDayClick = (day: string) => {
    setSelectedDay(day);
    setCurrentView('reports');
  };

  const handleBackToMonths = () => {
    setSelectedMonth(null);
    setSelectedDay(null);
    setCurrentView('months');
  };

  const handleBackToDays = () => {
    setSelectedDay(null);
    setCurrentView('days');
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>جاري تحميل الأرشيف...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>📂 أرشيف التقارير الذكية (CPO)</h1>
        <p className={styles.subtitle}>تصفح التقارير الآلية المحفوظة حسب الشهر واليوم</p>
      </header>

      {/* Breadcrumb Navigation */}
      {(currentView !== 'months') && (
        <div className={styles.breadcrumb}>
          <span className={styles.crumbLink} onClick={handleBackToMonths}>الأرشيف (جميع الأشهر)</span>
          
          {selectedMonth && (
            <>
              <span> / </span>
              <span 
                className={currentView === 'reports' ? styles.crumbLink : ''} 
                onClick={currentView === 'reports' ? handleBackToDays : undefined}
              >
                شهر {selectedMonth}
              </span>
            </>
          )}

          {selectedDay && (
            <>
              <span> / </span>
              <span>يوم {selectedDay.split('-').pop()}</span>
            </>
          )}
        </div>
      )}

      {/* View: Months */}
      {currentView === 'months' && (
        <>
          {months.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📁</div>
              <p>الأرشيف فارغ حالياً. سيتم حفظ التقارير هنا عند تفعيل الإرسال التلقائي.</p>
            </div>
          ) : (
            <div className={styles.foldersGrid}>
              {months.map(month => {
                const count = reports.filter(r => r.month === month).length;
                return (
                  <div key={month} className={styles.folderCard} onClick={() => handleMonthClick(month)}>
                    <div className={styles.folderIcon}>📁</div>
                    <div className={styles.folderName}>{month}</div>
                    <div className={styles.folderCount}>{count} تقرير</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* View: Days */}
      {currentView === 'days' && (
        <div className={styles.foldersGrid}>
          {daysInMonth.map(day => {
            const count = reports.filter(r => r.day === day).length;
            const dayNumber = day.split('-').pop(); // Get just the DD part
            return (
              <div key={day} className={styles.folderCard} onClick={() => handleDayClick(day)}>
                <div className={styles.folderIcon}>📄</div>
                <div className={styles.folderName}>يوم {dayNumber}</div>
                <div className={styles.folderCount}>{count} تقرير</div>
              </div>
            );
          })}
        </div>
      )}

      {/* View: Reports inside a Day */}
      {currentView === 'reports' && (
        <div className={styles.reportsList}>
          {reportsInDay.map((report) => (
            <div key={report.id} className={styles.reportItem}>
              <div className={styles.reportHeader}>
                <div className={styles.reportTime}>
                  🕒 {formatTimestamp(report.timestamp)}
                </div>
                <div className={styles.reportMeta}>
                  عدد المنتجات: {report.data ? report.data.length : 0}
                </div>
              </div>
              <pre className={styles.summaryPre}>
                {report.summaryText || 'لا يوجد ملخص نصي متوفر'}
              </pre>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
