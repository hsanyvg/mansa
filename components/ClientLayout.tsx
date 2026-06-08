"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ClientLayout.module.css';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, collection, writeBatch, getDoc } from "firebase/firestore";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Submenu states
  const [showCategories, setShowCategories] = useState(true);
  const [showPersons, setShowPersons] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showFinance, setShowFinance] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('يرجى ملء كافة الحقول.');
      return;
    }
    if (authMode === 'register' && password !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const userId = userCredential.user.uid;

        // Initialize user database
        const batch = writeBatch(db);
        const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
        batch.set(counterRef, { lastId: 100000 });

        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });

        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });

        await batch.commit();
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'حدث خطأ أثناء الاتصال. يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صالح.';
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      else if (err.code === 'auth/email-already-in-use') msg = 'البريد الإلكتروني مستخدم بالفعل.';
      else if (err.code === 'auth/weak-password') msg = 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل).';
      else if (err.code === 'auth/invalid-credential') msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const userId = userCredential.user.uid;

      // If new user, seed their Firestore subcollections
      const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
      const counterSnap = await getDoc(counterRef);

      if (!counterSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(counterRef, { lastId: 100000 });

        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });

        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });

        await batch.commit();
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'حدث خطأ أثناء الاتصال بجوجل، يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'تم إغلاق نافذة تسجيل الدخول من قبل المستخدم.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'تسجيل الدخول بجوجل غير مفعّل في لوحة Firebase. يرجى تفعيله من قسم Authentication -> Sign-in method.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'هذا النطاق (Domain) غير مصرح به في إعدادات Firebase لتسجيل الدخول بجوجل.';
      } else {
        msg = `${msg} (${err.code || err.message})`;
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121216', color: '#fff' }}>
        <h3>جاري التحقق من الهوية...</h3>
      </div>
    );
  }

  if (!user) {
    // Allow public access to mobile app download pages (so scanned phones don't get hit by the login screen)
    if (pathname === '/mobile-download' || pathname === '/download') {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#121216', width: '100%' }}>
          {children}
        </div>
      );
    }

    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h2 className={styles.authTitle}>منصة منسا</h2>
          <p className={styles.authSubtitle}>لوحة التحكم وإدارة المخازن والمبيعات</p>
          
          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>البريد الإلكتروني</label>
              <input
                className={styles.authInput}
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>كلمة المرور</label>
              <input
                className={styles.authInput}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {authMode === 'register' && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>تأكيد كلمة المرور</label>
                <input
                  className={styles.authInput}
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button type="submit" className={styles.authBtn} disabled={isSubmitting}>
              {isSubmitting ? 'جاري الاتصال...' : authMode === 'login' ? 'تسجيل الدخول 💾' : 'إنشاء حساب جديد ✨'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', width: '100%' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>
            <span style={{ padding: '0 10px', fontSize: '0.75rem', color: '#94a3b8' }}>أو</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>
          </div>

          <button 
            type="button" 
            onClick={handleGoogleSignIn} 
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.02)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background-color 0.2s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            تسجيل الدخول بواسطة Google
          </button>

          <button className={styles.authToggleBtn} onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setErrorMsg(''); }}>
            {authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
          </button>
        </div>
      </div>
    );
  }

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
          <Link href="/inventory" className={`${styles.submenuItem} ${pathname === '/inventory' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>إدارة المخازن والجرد</span>
            <span className={styles.submenuIcon}>📦</span>
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

        <div className={`${styles.submenu} ${showFinance ? styles.open : ''}`}>
          <Link href="/finance/expenses" className={`${styles.submenuItem} ${pathname === '/finance/expenses' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>المصروفات</span>
            <span className={styles.submenuIcon}>💸</span>
          </Link>
          <Link href="/finance/treasury" className={`${styles.submenuItem} ${pathname === '/finance/treasury' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>الخزينة</span>
            <span className={styles.submenuIcon}>🏛️</span>
          </Link>
          <Link href="/treasury" className={`${styles.submenuItem} ${pathname === '/treasury' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>تسوية الكشوفات</span>
            <span className={styles.submenuIcon}>🧾</span>
          </Link>
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
            <span>الأصناف الناقصة</span>
            <span className={styles.submenuIcon}>🪫</span>
          </div>
          <Link href="/finance/cpo" className={`${styles.submenuItem} ${pathname === '/finance/cpo' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>تقارير الإعلانات (CPO)</span>
            <span className={styles.submenuIcon}>🎯</span>
          </Link>
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
        <div 
          className={`${styles.menuItem} ${showSettings ? styles.active : ''}`} 
          onClick={() => {
            setShowSettings(!showSettings);
            if (!isSidebarOpen) setIsSidebarOpen(true);
          }} 
          title="الإعدادات"
        >
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{showSettings ? '▼' : '▶'}</span>
          <div className={styles.menuItemIcon}>
            <span>الإعدادات</span>
            <span className={styles.icon}>⚙️</span>
          </div>
        </div>

        {/* Submenu for Settings */}
        <div className={`${styles.submenu} ${showSettings ? styles.open : ''}`}>
          <Link href="/settings/currencies" className={`${styles.submenuItem} ${pathname === '/settings/currencies' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>العملات</span>
            <span className={styles.submenuIcon}>💱</span>
          </Link>
          <Link href="/settings/expense-categories" className={`${styles.submenuItem} ${pathname === '/settings/expense-categories' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>فئات المصروفات</span>
            <span className={styles.submenuIcon}>📂</span>
          </Link>
          <Link href="/settings/wallets" className={`${styles.submenuItem} ${pathname === '/settings/wallets' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>محافظ الخزينة</span>
            <span className={styles.submenuIcon}>🏦</span>
          </Link>

          <Link href="/settings/api-integrations" className={`${styles.submenuItem} ${pathname === '/settings/api-integrations' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>بوابة الربط (API)</span>
            <span className={styles.submenuIcon}>🔌</span>
          </Link>
        </div>
        <Link href="/integrations" className={`${styles.menuItem} ${pathname === '/integrations' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }} title="الربط والتتبع">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>الربط والتتبع</span>
            <span className={styles.icon}>🔗</span>
          </div>
        </Link>
        <Link href="/mobile-download" className={`${styles.menuItem} ${pathname === '/mobile-download' ? styles.active : ''}`} style={{ textDecoration: 'none', color: 'inherit' }} title="تحميل تطبيق الهاتف">
          <span></span>
          <div className={styles.menuItemIcon}>
            <span>تطبيق الهاتف</span>
            <span className={styles.icon}>📱</span>
          </div>
        </Link>

        {/* User Info & Logout */}
        {user && (
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', padding: isSidebarOpen ? '1rem' : '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            {isSidebarOpen && (
              <span style={{ fontSize: '0.8rem', color: '#adb5bd', wordBreak: 'break-all', textAlign: 'center', padding: '0 0.5rem' }} title={user.email || ''}>
                👤 {user.email}
              </span>
            )}
            <button 
              className={styles.logoutBtn} 
              onClick={() => signOut(auth).catch(err => console.error(err))}
              title="تسجيل الخروج"
              style={{ 
                width: isSidebarOpen ? '85%' : '36px', 
                height: isSidebarOpen ? 'auto' : '36px', 
                padding: isSidebarOpen ? '0.5rem 0.25rem' : '0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0.25rem 0'
              }}
            >
              <span>{isSidebarOpen ? '🚪 تسجيل الخروج' : '🚪'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={styles.contentWrapper}>
        {children}
      </div>
    </div>
  );
}
