"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ClientLayout.module.css';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  // Submenu states
  const [showCategories, setShowCategories] = useState(true);
  const [showPersons, setShowPersons] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className={styles.layoutContainer}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? '' : styles.closed}`}>
        
        {/* Sidebar Header with Toggle */}
        <div className={styles.sidebarHeader}>
          <div className={styles.logoText} style={{ fontWeight: 'bold', color: '#fff', paddingRight: '0.5rem' }}>
            نظام المخازن
          </div>
          <button 
            className={styles.toggleBtn}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "طي القائمة" : "إظهار القائمة"}
          >
            {isSidebarOpen ? '⮈' : '⮊'}
          </button>
        </div>

        {/* Dashboard / Analytics Menu Item */}
        <Link href="/" className={`${styles.menuItem} ${pathname === '/' ? styles.active : ''}`} style={{ marginTop: '1rem', textDecoration: 'none', color: 'inherit' }} title="تحليل المبيعات والاداء">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>تحليل المبيعات والاداء</span>
            <span className={styles.icon}>📊</span>
          </div>
        </Link>

        {/* Categories Menu Item */}
        <div 
          className={`${styles.menuItem} ${showCategories ? styles.active : ''}`}
          onClick={() => {
             setShowCategories(!showCategories);
             if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showCategories ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon} title="الأصناف">
            <span>الأصناف</span>
            <span className={styles.icon}>🏷️</span>
          </div>
        </div>

        {/* Submenu for Categories */}
        <div className={`${styles.submenu} ${showCategories ? styles.open : ''}`}>
          <Link href="/units" className={`${styles.submenuItem} ${pathname === '/units' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>الوحدات</span>
            <span className={styles.submenuIcon}>📦</span>
          </Link>
          <Link href="/stores" className={`${styles.submenuItem} ${pathname === '/stores' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>المخازن</span>
            <span className={styles.submenuIcon}>🏛️</span>
          </Link>
          <Link href="/categories" className={`${styles.submenuItem} ${pathname === '/categories' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>الفئات</span>
            <span className={styles.submenuIcon}>🗂️</span>
          </Link>
          <Link href="/products" className={`${styles.submenuItem} ${pathname === '/products' ? styles.active : ''}`}>
            <span>الأصناف</span>
            <span className={styles.submenuIcon}>⊞</span>
          </Link>
          <Link href="/transfers" className={`${styles.submenuItem} ${pathname === '/transfers' ? styles.active : ''}`}>
            <span>إذن تحويل</span>
            <span className={styles.submenuIcon}>⇄</span>
          </Link>

        </div>

        {/* Persons Menu Item */}
        <div 
          className={`${styles.menuItem} ${showPersons ? styles.active : ''}`}
          onClick={() => {
            setShowPersons(!showPersons);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showPersons ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon} title="الأشخاص">
            <span>الاشخاص</span>
            <span className={styles.icon}>👥</span>
          </div>
        </div>

        {/* Submenu for Persons */}
        <div className={`${styles.submenu} ${showPersons ? styles.open : ''}`}>
          <Link href="/customers" className={`${styles.submenuItem} ${pathname === '/customers' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>قائمة العملاء</span>
            <span className={styles.submenuIcon}>👥</span>
          </Link>

          <Link href="/suppliers" className={`${styles.submenuItem} ${pathname === '/suppliers' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>قائمة الموردين</span>
            <span className={styles.submenuIcon}>🚚</span>
          </Link>
          <Link href="/employees" className={`${styles.submenuItem} ${pathname === '/employees' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>قائمة الموظفين</span>
            <span className={styles.submenuIcon}>👤</span>
          </Link>

          <div className={styles.submenuItem}>
            <span>المستخدمين</span>
            <span className={styles.submenuIcon}>👥</span>
          </div>
          <div className={styles.submenuItem}>
            <span>صلاحيات المستخدمين</span>
            <span className={styles.submenuIcon}>👮</span>
          </div>
        </div>

        {/* Invoices Menu Item */}
        <div 
          className={`${styles.menuItem} ${showInvoices ? styles.active : ''}`}
          onClick={() => {
            setShowInvoices(!showInvoices);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showInvoices ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon} title="الفواتير">
            <span>الفواتير</span>
            <span className={styles.icon}>🧾</span>
          </div>
        </div>

        {/* Submenu for Invoices */}
        <div className={`${styles.submenu} ${showInvoices ? styles.open : ''}`}>
          <Link href="/sales-invoices" className={`${styles.submenuItem} ${pathname === '/sales-invoices' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>فواتير المبيعات</span>
            <span className={styles.submenuIcon}>📈</span>
          </Link>

          <Link href="/sales-returns" className={`${styles.submenuItem} ${pathname === '/sales-returns' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>مرتجعات المبيعات</span>
            <span className={styles.submenuIcon}>↩️</span>
          </Link>
          <Link href="/purchases" className={`${styles.submenuItem} ${pathname === '/purchases' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>فواتير المشتريات</span>
            <span className={styles.submenuIcon}>🗓️</span>
          </Link>
          <div className={styles.submenuItem}>
            <span>مرتجعات المشتريات</span>
            <span className={styles.submenuIcon}>↩️</span>
          </div>
          <div className={styles.submenuItem}>
            <span>كشف حساب عميل ومورد</span>
            <span className={styles.submenuIcon}>🖥️</span>
          </div>
        </div>

        {/* Finance Menu Item */}
        <div 
          className={`${styles.menuItem} ${showFinance ? styles.active : ''}`}
          onClick={() => {
            setShowFinance(!showFinance);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showFinance ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon} title="المالية">
            <span>المالية</span>
            <span className={styles.icon}>💵</span>
          </div>
        </div>

        {/* Submenu for Finance */}
        <div className={`${styles.submenu} ${showFinance ? styles.open : ''}`}>
          <div className={styles.submenuItem}>
            <span>المصروفات</span>
            <span className={styles.submenuIcon}>💸</span>
          </div>
          <div className={styles.submenuItem}>
            <span>الخزينة</span>
            <span className={styles.submenuIcon}>🏛️</span>
          </div>
          <div className={styles.submenuItem}>
            <span>خزينة عملة</span>
            <span className={styles.submenuIcon}>💶</span>
          </div>
          <div className={styles.submenuItem}>
            <span>الحسابات البنكية</span>
            <span className={styles.submenuIcon}>💳</span>
          </div>
          <div className={styles.submenuItem}>
            <span>العملات</span>
            <span className={styles.submenuIcon}>💱</span>
          </div>
        </div>

        {/* Reports Menu Item */}
        <div 
          className={`${styles.menuItem} ${showReports ? styles.active : ''}`}
          onClick={() => {
            setShowReports(!showReports);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }}
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showReports ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon} title="التقارير">
            <span>التقارير</span>
            <span className={styles.icon}>📄</span>
          </div>
        </div>

        {/* Submenu for Reports */}
        <div className={`${styles.submenu} ${showReports ? styles.open : ''}`}>
          <div className={styles.submenuItem}>
            <span>كشف اليومية</span>
            <span className={styles.submenuIcon}>📅</span>
          </div>
          <div className={styles.submenuItem}>
            <span>تقرير الأرباح</span>
            <span className={styles.submenuIcon}>📈</span>
          </div>
          <div className={styles.submenuItem}>
            <span>تقرير الأصناف</span>
            <span className={styles.submenuIcon}>▥</span>
          </div>
          <div className={styles.submenuItem}>
            <span>الأصناف الناقصة</span>
            <span className={styles.submenuIcon}>🪫</span>
          </div>
        </div>

        {/* Other menu items */}
        <Link href="/orders/entry" className={`${styles.menuItem} ${pathname === '/orders/entry' ? styles.active : ''}`} style={{ marginTop: '1rem', textDecoration: 'none', color: 'inherit' }} title="إدخال الطلبات">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>إدخال الطلبات</span>
            <span className={styles.icon}>✍️</span>
          </div>
        </Link>
        <Link href="/composite-products" className={`${styles.menuItem} ${pathname === '/composite-products' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }} title="المنتجات التجميعية">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>المنتجات التجميعية</span>
            <span className={styles.icon}>🧩</span>
          </div>
        </Link>
        <Link href="/orders/list" className={`${styles.menuItem} ${pathname === '/orders/list' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }} title="الطلبات">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>الطلبات</span>
            <span className={styles.icon}>📦</span>
          </div>
        </Link>
        <div className={styles.menuItem} onClick={() => setShowSettings(!showSettings)} title="الإعدادات">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>الإعدادات</span>
            <span className={styles.icon}>⚙️</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.contentWrapper}>
        {children}
      </div>
    </div>
  );
}
