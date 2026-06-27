"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, serverTimestamp, writeBatch 
} from 'firebase/firestore';

// Helper to compress and convert image to low-quality JPEG Base64
const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));
        ctx.drawImage(img, 0, 0, width, height);

        // Export as low-quality JPEG (0.6 quality is highly compressed and small)
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(base64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Types
interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: string;
  date: string;
  time: string; 
  details: string;
  pageName: string;
  branchName?: string;
  itemName?: string;
  walletId?: string;
  walletName?: string;
  isArchived?: boolean;
  createdAt: any;
  imageUrl?: string;
  imageUrls?: string[];
}

export default function ExpensesPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState<any[]>([]);
  
  // Form State
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('IQD');
  const [date, setDate] = useState('');
  const [details, setDetails] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeImagesList, setActiveImagesList] = useState<string[] | null>(null);
  
  // Filtering & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');
  const [showArchivedInActive, setShowArchivedInActive] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Aggregated Expenses Summary States
  const [showSummary, setShowSummary] = useState(false);
  const [expandedSummaryPages, setExpandedSummaryPages] = useState<Record<string, boolean>>({});
  const [expandedSummaryBranches, setExpandedSummaryBranches] = useState<Record<string, boolean>>({});
  const [expandedSummarySubcats, setExpandedSummarySubcats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    
    // Default range: This Month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(today);

    // Close date picker on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const unsubCats = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expense_categories'), s => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPages = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'), s => setPages(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBranches = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'), s => setAllCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProducts = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'), s => setAllProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExp = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses'), s => {
      setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]);
      setLoading(false);
    });
    const unsubWallets = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'wallets'), s => setWallets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTreasury = onSnapshot(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'), s => setTreasuryTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubCats(); unsubPages(); unsubBranches(); unsubProducts(); unsubExp(); unsubWallets(); unsubTreasury(); };
  }, [isMounted]);

  const showToastMsg = (m: string, t: 'success' | 'error' = 'success') => {
    setToast({ message: m, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setCategoryId(''); setAmount(''); setDetails('');
    setSelectedPageId(''); setSelectedBranchId(''); setSelectedItemId(''); setSelectedWalletId('');
    setDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
    setImagePreviews([]);
    setImageUrls([]);
  };

  const getWalletBalance = (walletId: string, curr: string) => {
    return treasuryTransactions.reduce((total, t) => {
      if (t.currency !== curr) return total;
      if (t.type === 'deposit' && t.walletId === walletId) return total + t.amount;
      if (t.type === 'withdraw' && t.walletId === walletId) return total - t.amount;
      if (t.type === 'transfer') {
        if (t.fromWalletId === walletId) return total - t.amount;
        if (t.toWalletId === walletId) return total + t.amount;
      }
      return total;
    }, 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount || !date || !details || !selectedWalletId) return showToastMsg("يرجى ملء الحقول الإجبارية واختيار المحفظة", "error");
    
    const numAmount = Number(amount);
    const currentBalance = getWalletBalance(selectedWalletId, currency);
    if (!editingId && numAmount > currentBalance) {
      return showToastMsg("عذراً، رصيد المحفظة المحددة لا يكفي لدفع هذا المصروف", "error");
    }

    const cat = categories.find(c => c.id === categoryId);
    const pg = pages.find(p => p.id === selectedPageId);
    const br = allCategories.find(b => b.id === selectedBranchId);
    const it = allProducts.find(i => i.id === selectedItemId);
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const data: any = {
      categoryId, 
      categoryName: cat?.name || 'غير محدد',
      amount: numAmount, 
      currency, 
      date, 
      time: currentTime, 
      details,
      pageName: pg?.name || '', 
      branchName: br?.name || '', 
      itemName: it?.name || '',
      walletId: selectedWalletId,
      walletName: selectedWallet?.name || '',
      imageUrl: imageUrls[0] || '',
      imageUrls: imageUrls
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses', editingId), data);
        showToastMsg("تم التحديث بنجاح");
      } else {
        const batch = writeBatch(db);
        const expenseRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses'));
        const treasuryRef = doc(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'treasury_transactions'));

        batch.set(expenseRef, { ...data, isArchived: false, createdAt: serverTimestamp() });
        batch.set(treasuryRef, {
          type: 'withdraw',
          walletId: selectedWalletId,
          amount: numAmount,
          currency: currency,
          date: date,
          time: currentTime,
          details: `صرف آلي لفئة ${cat?.name || 'غير محدد'} - ${details}`,
          createdAt: serverTimestamp(),
          isAutomated: true,
          expenseId: expenseRef.id
        });
        
        await batch.commit();
        showToastMsg("تم حفظ المصروف وخصمه من الخزينة بنجاح");
        
        // Ensure visibility: If date is outside current range, expand range
        if (startDate && date < startDate) setStartDate(date);
        if (endDate && date > endDate) setEndDate(date);
      }
      resetForm();
    } catch (err) { 
      showToastMsg("حدث خطأ أثناء الحفظ", "error"); 
    }
  };

  const handleEdit = (exp: Expense) => {
    setEditingId(exp.id); setCategoryId(exp.categoryId); setAmount(exp.amount.toString());
    setCurrency(exp.currency); setDate(exp.date); setDetails(exp.details);
    if (exp.walletId) setSelectedWalletId(exp.walletId);
    
    const urls = exp.imageUrls || (exp.imageUrl ? [exp.imageUrl] : []);
    setImageUrls(urls);
    setImagePreviews(urls);
    const pg = pages.find(p => p.name === exp.pageName);
    if (pg) {
      setSelectedPageId(pg.id);
      const br = allCategories.find(b => b.pageId === pg.id && b.name === exp.branchName);
      if (br) {
        setSelectedBranchId(br.id);
        const it = allProducts.find(i => i.categoryId === br.id && i.name === exp.itemName);
        if (it) setSelectedItemId(it.id);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses', id));
      showToastMsg("تم الحذف بنجاح");
      setDeleteConfirmId(null);
    } catch (err) { showToastMsg("فشل الحذف", "error"); }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses', id), { isArchived: true });
      showToastMsg("تمت الأرشفة");
    } catch (err) { showToastMsg("فشل الأرشفة", "error"); }
  };

  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses', id), { isArchived: false });
      showToastMsg("تمت الاستعادة");
    } catch (err) { showToastMsg("فشل الاستعادة", "error"); }
  };

  const handleArchiveFiltered = async () => {
    const toArchive = filteredAndSearched.filter(e => !e.isArchived);
    if (toArchive.length === 0) return showToastMsg("لا توجد مصروفات نشطة للأرشفة", "error");
    
    try {
      await Promise.all(toArchive.map(e => updateDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'expenses', e.id), { isArchived: true })));
      showToastMsg("تمت أرشفة العمليات المحددة بنجاح");
    } catch (err) { showToastMsg("فشل الأرشفة الجماعية", "error"); }
  };

  const setRangeShortcut = (type: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'last7':
        start.setDate(today.getDate() - 6);
        break;
      case 'last14':
        start.setDate(today.getDate() - 13);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setIsDatePickerOpen(false);
  };

  const filteredAndSearched = expenses.filter(exp => {
    // 1. Tab & Archive Toggle Logic
    if (activeTab === 'archive') {
      if (!exp.isArchived) return false;
    } else {
      // Active tab: show active items. If toggle is ON, show both.
      if (!showArchivedInActive && exp.isArchived) return false;
    }
    const matchDate = (!startDate || exp.date >= startDate) && (!endDate || exp.date <= endDate);
    if (!matchDate) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        (exp.details && exp.details.toLowerCase().includes(q)) ||
        (exp.categoryName && exp.categoryName.toLowerCase().includes(q)) ||
        (exp.pageName && exp.pageName.toLowerCase().includes(q)) ||
        (exp.branchName && exp.branchName.toLowerCase().includes(q)) ||
        (exp.itemName && exp.itemName.toLowerCase().includes(q)) ||
        (exp.amount && exp.amount.toString().includes(q)) ||
        (exp.amount && exp.amount.toLocaleString().includes(q)) ||
        (exp.date && exp.date.includes(q)) ||
        (exp.time && exp.time.includes(q));
      if (!matchSearch) return false;
    }
    return true;
  });

  const grouped = filteredAndSearched.reduce((acc: any, e) => {
    const k = e.date ? e.date.substring(0, 7) : 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(e);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const toggleSummaryPage = (pageName: string) => {
    setExpandedSummaryPages(prev => ({ ...prev, [pageName]: !prev[pageName] }));
  };

  const toggleSummaryBranch = (branchKey: string) => {
    setExpandedSummaryBranches(prev => ({ ...prev, [branchKey]: !prev[branchKey] }));
  };

  const toggleSummarySubcat = (subcatKey: string) => {
    setExpandedSummarySubcats(prev => ({ ...prev, [subcatKey]: !prev[subcatKey] }));
  };

  const getAggregatedSummary = () => {
    let totalIQD = 0;
    let totalUSD = 0;
    let generalIQD = 0;
    let generalUSD = 0;
    let pageIQD = 0;
    let pageUSD = 0;

    const pageGroups: Record<string, {
      name: string;
      totalIQD: number;
      totalUSD: number;
      branches: Record<string, {
        name: string;
        totalIQD: number;
        totalUSD: number;
        subcategories: Record<string, {
          name: string;
          totalIQD: number;
          totalUSD: number;
          items: Record<string, {
            name: string;
            totalIQD: number;
            totalUSD: number;
          }>
        }>
      }>
    }> = {};

    filteredAndSearched.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const curr = exp.currency || 'IQD';

      if (curr === 'IQD') {
        totalIQD += amt;
        if (!exp.pageName) generalIQD += amt;
        else pageIQD += amt;
      } else {
        totalUSD += amt;
        if (!exp.pageName) generalUSD += amt;
        else pageUSD += amt;
      }

      const pKey = exp.pageName || 'مصروفات عامة (بدون بيج)';
      if (!pageGroups[pKey]) {
        pageGroups[pKey] = {
          name: pKey,
          totalIQD: 0,
          totalUSD: 0,
          branches: {}
        };
      }
      const pGrp = pageGroups[pKey];
      if (curr === 'IQD') pGrp.totalIQD += amt;
      else pGrp.totalUSD += amt;

      if (exp.branchName) {
        const bKey = exp.branchName;
        if (!pGrp.branches[bKey]) {
          pGrp.branches[bKey] = {
            name: bKey,
            totalIQD: 0,
            totalUSD: 0,
            subcategories: {}
          };
        }
        const bGrp = pGrp.branches[bKey];
        if (curr === 'IQD') bGrp.totalIQD += amt;
        else bGrp.totalUSD += amt;

        // Resolve subcategory dynamically from product data or category
        let subName = 'بدون فئة فرعية';
        if (exp.itemName) {
          const product = allProducts.find(p => p.name === exp.itemName);
          if (product && product.subcategoryId) {
            const category = allCategories.find(c => c.id === product.categoryId);
            if (category && category.subcategories) {
              const sub = category.subcategories.find((s: any) => s.id === product.subcategoryId);
              if (sub) subName = sub.name;
            }
          }
        }

        if (!bGrp.subcategories[subName]) {
          bGrp.subcategories[subName] = {
            name: subName,
            totalIQD: 0,
            totalUSD: 0,
            items: {}
          };
        }
        const sGrp = bGrp.subcategories[subName];
        if (curr === 'IQD') sGrp.totalIQD += amt;
        else sGrp.totalUSD += amt;

        if (exp.itemName) {
          const iKey = exp.itemName;
          if (!sGrp.items[iKey]) {
            sGrp.items[iKey] = {
              name: iKey,
              totalIQD: 0,
              totalUSD: 0
            };
          }
          const iGrp = sGrp.items[iKey];
          if (curr === 'IQD') iGrp.totalIQD += amt;
          else iGrp.totalUSD += amt;
        }
      }
    });

    return {
      totalIQD,
      totalUSD,
      generalIQD,
      generalUSD,
      pageIQD,
      pageUSD,
      pageGroups
    };
  };

  const summary = getAggregatedSummary();

  if (!isMounted) return null;

  return (
    <div className={styles.container}>
      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}
      
      <header className={styles.header}>
        <h1 className={styles.title}>إدارة المصروفات</h1>
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'current' ? styles.activeTab : ''}`} 
            onClick={() => { setActiveTab('current'); setSearchQuery(''); setShowArchivedInActive(false); }}
          >
            📋 المصروفات النشطة
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'archive' ? styles.activeTab : ''}`} 
            onClick={() => { setActiveTab('archive'); setSearchQuery(''); }}
          >
            🗄️ أرشيف المصروفات
          </button>
        </div>
      </header>

      {activeTab === 'current' && (
        <form className={styles.card} onSubmit={handleSave}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}><label className={styles.label}>الفئة</label><select className={styles.select} value={categoryId} onChange={e => setCategoryId(e.target.value)} required><option value="">اختر الفئة...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className={styles.formGroup}><label className={styles.label}>المبلغ</label><div className={styles.amountWrapper}><input type="number" className={`${styles.input} ${styles.amountInput}`} value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" /><select className={styles.select} value={currency} onChange={e => setCurrency(e.target.value)}><option value="IQD">د.ع</option><option value="USD">$</option></select></div></div>
            <div className={styles.formGroup}><label className={styles.label}>دُفع من محفظة (إلزامي)</label><select className={styles.select} value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)} required disabled={!!editingId}><option value="">اختر المحفظة...</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div className={styles.formGroup}>
              <label className={styles.label}>التاريخ</label>
              <div className={styles.dateInputWrapper}>
                <input 
                  type="date" 
                  className={`${styles.input} ${date !== new Date().toISOString().split('T')[0] ? styles.notToday : ''}`} 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                />
                {date !== new Date().toISOString().split('T')[0] && <span className={styles.dateWarning}>⚠️ انتبه! ليس تاريخ اليوم</span>}
              </div>
            </div>
            <div className={styles.formGroup}><label className={styles.label}>البيان / التفاصيل</label><input type="text" className={styles.input} value={details} onChange={e => setDetails(e.target.value)} required placeholder="اكتب التفاصيل هنا..." /></div>
            <div className={styles.formGroup}><label className={styles.label}>البيج (اختياري)</label><select className={styles.select} value={selectedPageId} onChange={e => { setSelectedPageId(e.target.value); setSelectedBranchId(''); setSelectedItemId(''); }}><option value="">اختر البيج...</option>{pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className={styles.formGroup}><label className={styles.label}>الفرع (اختياري)</label><select className={styles.select} value={selectedBranchId} onChange={e => { setSelectedBranchId(e.target.value); setSelectedItemId(''); }} disabled={!selectedPageId}><option value="">اختر الفرع...</option>{allCategories.filter(b => b.pageId === selectedPageId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className={styles.formGroup}><label className={styles.label}>الصنف (اختياري)</label><select className={styles.select} value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} disabled={!selectedBranchId}><option value="">اختر الصنف...</option>{allProducts.filter(i => i.categoryId === selectedBranchId).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
            <div className={styles.formGroup}>
              <label className={styles.label}>صور الفاتورة / الوصل (اختياري)</label>
              <input 
                type="file" 
                multiple
                ref={fileInputRef}
                accept="image/*" 
                onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setIsUploading(true);
                    try {
                      const compressedList = await Promise.all(
                        files.map(file => compressImageToBase64(file))
                      );
                      setImagePreviews(prev => [...prev, ...compressedList]);
                      setImageUrls(prev => [...prev, ...compressedList]);
                    } catch (err) {
                      showToastMsg("فشل معالجة وضغط الصور", "error");
                    } finally {
                      setIsUploading(false);
                    }
                  }
                }} 
                style={{ display: 'none' }}
              />

              {imagePreviews.length === 0 ? (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.uploadAreaBtn}
                >
                  📁 اختيار صور الفاتورة
                </button>
              ) : (
                <div className={styles.imageManagerContainer}>
                  <div className={styles.previewsGrid}>
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className={styles.previewItem}>
                        <img src={preview} alt={`Preview ${index + 1}`} className={styles.previewImage} />
                        <button 
                          type="button" 
                          onClick={() => {
                            setImagePreviews(prev => prev.filter((_, i) => i !== index));
                            setImageUrls(prev => prev.filter((_, i) => i !== index));
                          }} 
                          className={styles.removeImageBtnSmall}
                          title="حذف الصورة"
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.imageActionButtonsRow}>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={styles.addImageBtnInline}
                    >
                      ➕ إضافة صورة
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setImagePreviews([]);
                        setImageUrls([]);
                      }}
                      className={styles.deleteAllImagesBtnInline}
                    >
                      🗑️ حذف الكل
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={isUploading}>
              {isUploading ? '⏳ جاري ضغط الصور...' : editingId ? '🔄 تحديث العملية' : '💾 حفظ العملية'}
            </button>
            {editingId && <button type="button" className={styles.cancelBtn} onClick={resetForm} disabled={isUploading}>إلغاء التعديل</button>}
          </div>
        </form>
      )}

      <div className={styles.filterSection}>
        <div className={styles.searchWrapper}><span className={styles.searchIcon}>🔍</span><input type="text" className={styles.searchInput} placeholder="بحث عن تاريخ، مبلغ، بيان أو فئة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <div className={styles.datePickerContainer} ref={datePickerRef} style={{ position: 'relative' }}>
          <button className={styles.dateRangeBtn} onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}>📅 {startDate || 'من'} ⬅️ {endDate || 'إلى'}</button>
          {isDatePickerOpen && (
            <div className={styles.dateModal}>
              <div className={styles.shortcutList}>
                <button className={styles.shortcutBtn} onClick={() => setRangeShortcut('today')}>اليوم</button>
                <button className={styles.shortcutBtn} onClick={() => setRangeShortcut('yesterday')}>أمس</button>
                <button className={styles.shortcutBtn} onClick={() => setRangeShortcut('last7')}>آخر 7 أيام</button>
                <button className={styles.shortcutBtn} onClick={() => setRangeShortcut('last14')}>آخر 14 يوماً</button>
                <button className={styles.shortcutBtn} onClick={() => setRangeShortcut('thisMonth')}>هذا الشهر</button>
              </div>
              <div className={styles.dateInputs}>
                <div className={styles.dateInputGroup}><label>من تاريخ:</label><input type="date" className={styles.input} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className={styles.dateInputGroup}><label>إلى تاريخ:</label><input type="date" className={styles.input} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              </div>
            </div>
          )}
        </div>
        {activeTab === 'current' ? (
          <button 
            className={`${styles.showArchivedBtn} ${showArchivedInActive ? styles.activeToggle : ''}`} 
            onClick={() => setShowArchivedInActive(!showArchivedInActive)}
          >
            {showArchivedInActive ? '🚫 إخفاء المؤرشفة' : '📂 إظهار المؤرشفة مع النشطة'}
          </button>
        ) : (
          <button className={styles.archiveAllBtn} onClick={handleArchiveFiltered}>📦 أرشفة المصفاة</button>
        )}
      </div>

      <div className={styles.summaryToggleContainer}>
        <button 
          className={styles.summaryToggleBtn} 
          onClick={() => setShowSummary(!showSummary)}
        >
          {showSummary ? '📊 إخفاء خلاصة المصروفات المجمّعة' : '📊 عرض خلاصة وإجمالي المصروفات بالتفصيل'}
        </button>
      </div>

      {showSummary && (
        <div className={styles.summaryCard}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>💰</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>إجمالي المصروفات (دينار)</span>
                <span className={styles.statValue}>{summary.totalIQD.toLocaleString()} د.ع</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>💵</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>إجمالي المصروفات (دولار)</span>
                <span className={styles.statValue}>${summary.totalUSD.toLocaleString()}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🏢</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>مصروفات البيجات</span>
                <span className={styles.statValue}>{summary.pageIQD.toLocaleString()} د.ع / ${summary.pageUSD.toLocaleString()}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🌍</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>مصروفات عامة (بدون بيج)</span>
                <span className={styles.statValue}>{summary.generalIQD.toLocaleString()} د.ع / ${summary.generalUSD.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className={styles.treeSection}>
            <h3 className={styles.treeSectionTitle}>📂 تفصيل المصروفات الهرمي (شجرة الحسابات)</h3>
            <div className={styles.treeContainer}>
              {Object.values(summary.pageGroups).map(page => {
                const pageKey = page.name;
                const isPageExpanded = !!expandedSummaryPages[pageKey];
                const hasBranches = Object.keys(page.branches).length > 0;

                return (
                  <div key={pageKey} className={styles.treeNode}>
                    <div 
                      className={`${styles.nodeHeader} ${styles.pageNode}`}
                      onClick={() => hasBranches && toggleSummaryPage(pageKey)}
                      style={{ cursor: hasBranches ? 'pointer' : 'default' }}
                    >
                      <div className={styles.nodeLeft}>
                        {hasBranches && <span className={styles.arrowIcon}>{isPageExpanded ? '▼' : '▶'}</span>}
                        <span className={styles.nodeName}>🏢 {page.name}</span>
                      </div>
                      <div className={styles.nodeAmount}>
                        {page.totalIQD > 0 && <span className={styles.iqdBadge}>{page.totalIQD.toLocaleString()} د.ع</span>}
                        {page.totalUSD > 0 && <span className={styles.usdBadge}>${page.totalUSD.toLocaleString()}</span>}
                      </div>
                    </div>

                    {isPageExpanded && hasBranches && (
                      <div className={styles.nodeChildren}>
                        {Object.values(page.branches).map(branch => {
                          const branchKey = `${pageKey}::${branch.name}`;
                          const isBranchExpanded = !!expandedSummaryBranches[branchKey];
                          const hasSubcats = Object.keys(branch.subcategories).length > 0;

                          return (
                            <div key={branchKey} className={styles.treeNode}>
                              <div 
                                className={`${styles.nodeHeader} ${styles.branchNode}`}
                                onClick={() => hasSubcats && toggleSummaryBranch(branchKey)}
                                style={{ cursor: hasSubcats ? 'pointer' : 'default' }}
                              >
                                <div className={styles.nodeLeft}>
                                  {hasSubcats && <span className={styles.arrowIcon}>{isBranchExpanded ? '▼' : '▶'}</span>}
                                  <span className={styles.nodeName}>🌿 {branch.name}</span>
                                </div>
                                <div className={styles.nodeAmount}>
                                  {branch.totalIQD > 0 && <span className={styles.iqdBadge}>{branch.totalIQD.toLocaleString()} د.ع</span>}
                                  {branch.totalUSD > 0 && <span className={styles.usdBadge}>${branch.totalUSD.toLocaleString()}</span>}
                                </div>
                              </div>

                              {isBranchExpanded && hasSubcats && (
                                <div className={styles.nodeChildren}>
                                  {Object.values(branch.subcategories).map(subcat => {
                                    const subcatKey = `${branchKey}::${subcat.name}`;
                                    const isSubcatExpanded = !!expandedSummarySubcats[subcatKey];
                                    const hasItems = Object.keys(subcat.items).length > 0;

                                    return (
                                      <div key={subcatKey} className={styles.treeNode}>
                                        <div 
                                          className={`${styles.nodeHeader} ${styles.subcatNode}`}
                                          onClick={() => hasItems && toggleSummarySubcat(subcatKey)}
                                          style={{ cursor: hasItems ? 'pointer' : 'default' }}
                                        >
                                          <div className={styles.nodeLeft}>
                                            {hasItems && <span className={styles.arrowIcon}>{isSubcatExpanded ? '▼' : '▶'}</span>}
                                            <span className={styles.nodeName}>🍂 {subcat.name}</span>
                                          </div>
                                          <div className={styles.nodeAmount}>
                                            {subcat.totalIQD > 0 && <span className={styles.iqdBadge}>{subcat.totalIQD.toLocaleString()} د.ع</span>}
                                            {subcat.totalUSD > 0 && <span className={styles.usdBadge}>${subcat.totalUSD.toLocaleString()}</span>}
                                          </div>
                                        </div>

                                        {isSubcatExpanded && hasItems && (
                                          <div className={styles.nodeChildren}>
                                            {Object.values(subcat.items).map(item => (
                                              <div key={item.name} className={`${styles.nodeHeader} ${styles.itemNode}`}>
                                                <div className={styles.nodeLeft}>
                                                  <span className={styles.nodeName}>🏷️ {item.name}</span>
                                                </div>
                                                <div className={styles.nodeAmount}>
                                                  {item.totalIQD > 0 && <span className={styles.iqdBadge}>{item.totalIQD.toLocaleString()} د.ع</span>}
                                                  {item.totalUSD > 0 && <span className={styles.usdBadge}>${item.totalUSD.toLocaleString()}</span>}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <section className={styles.tableSection}>
        {activeTab === 'archive' ? (
          <>
            {months.map(m => (
              <div key={m} className={styles.archiveGroup}>
                <div className={styles.monthHeader}>
                  <span>📅 شهر: {m}</span>
                  <span className={styles.monthTotal}>إجمالي: {grouped[m].reduce((s:any, e:any) => s + (e.currency === 'IQD' ? e.amount : 0), 0).toLocaleString('en-US')} د.ع / {grouped[m].reduce((s:any, e:any) => s + (e.currency === 'USD' ? e.amount : 0), 0).toLocaleString('en-US')} $</span>
                </div>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead><tr><th>التاريخ</th><th>الفئة</th><th>المركز المالي</th><th>البيان</th><th>المرفقات</th><th>المبلغ</th><th style={{ textAlign: 'center' }}>إجراءات</th></tr></thead>
                    <tbody>
                      {grouped[m].map((exp:any) => (
                        <tr key={exp.id}>
                          <td>{exp.date}{exp.time && <span className={styles.timeText}>🕒 {exp.time}</span>}</td>
                          <td><span className={styles.categoryTag}>{exp.categoryName}</span></td>
                          <td><div className={styles.costCenterBox}><span className={styles.pageText}>{exp.pageName}</span>{exp.branchName && <span className={styles.branchText}> / {exp.branchName}</span>}{exp.itemName && <span className={styles.itemText}> / {exp.itemName}</span>}</div></td>
                          <td>
                            {exp.details}
                            {exp.isArchived && <span className={styles.archivedBadge}>مؤرشف</span>}
                          </td>
                          <td>
                            {exp.imageUrls && exp.imageUrls.length > 0 ? (
                              <button 
                                type="button"
                                onClick={() => setActiveImagesList(exp.imageUrls || [])} 
                                className={styles.attachmentBtnLink}
                              >
                                🖼️ عرض الوصل ({exp.imageUrls.length})
                              </button>
                            ) : exp.imageUrl ? (
                              <button 
                                type="button"
                                onClick={() => setActiveImagesList([exp.imageUrl || ''])} 
                                className={styles.attachmentBtnLink}
                              >
                                🖼️ عرض الوصل (1)
                              </button>
                            ) : (
                              <span className={styles.noAttachment}>-</span>
                            )}
                          </td>
                          <td className={styles.amountCell}>{exp.amount.toLocaleString('en-US')} {exp.currency === 'IQD' ? 'د.ع' : '$'}</td>
                          <td>
                            <div className={styles.actionButtons}>
                              <button className={styles.editBtn} onClick={() => handleRestore(exp.id)} title="استعادة">🔓</button>
                              <button className={styles.deleteBtn} onClick={() => setDeleteConfirmId(exp.id)} title="حذف">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {months.length === 0 && !loading && <div className={styles.emptyState}>لا توجد نتائج في الأرشيف</div>}
          </>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead><tr><th>التاريخ</th><th>الفئة</th><th>المركز المالي</th><th>البيان / التفاصيل</th><th>المرفقات</th><th>المبلغ</th><th style={{ textAlign: 'center' }}>إجراءات</th></tr></thead>
              <tbody>
                {filteredAndSearched.map(exp => (
                  <tr key={exp.id} className={`${editingId === exp.id ? styles.editingRow : ''} ${exp.isArchived ? styles.archivedRow : ''}`}>
                    <td>{exp.date}{exp.time && <span className={styles.timeText}>🕒 {exp.time}</span>}</td>
                    <td><span className={styles.categoryTag}>{exp.categoryName}</span></td>
                    <td><div className={styles.costCenterBox}><span className={styles.pageText}>{exp.pageName}</span>{exp.branchName && <span className={styles.branchText}> / {exp.branchName}</span>}{exp.itemName && <span className={styles.itemText}> / {exp.itemName}</span>}</div></td>
                    <td>
                      {exp.details}
                      {exp.isArchived && <span className={styles.archivedBadge}>مؤرشف</span>}
                    </td>
                    <td>
                      {exp.imageUrls && exp.imageUrls.length > 0 ? (
                        <button 
                          type="button"
                          onClick={() => setActiveImagesList(exp.imageUrls || [])} 
                          className={styles.attachmentBtnLink}
                        >
                          🖼️ عرض الوصل ({exp.imageUrls.length})
                        </button>
                      ) : exp.imageUrl ? (
                        <button 
                          type="button"
                          onClick={() => setActiveImagesList([exp.imageUrl || ''])} 
                          className={styles.attachmentBtnLink}
                        >
                          🖼️ عرض الوصل (1)
                        </button>
                      ) : (
                        <span className={styles.noAttachment}>-</span>
                      )}
                    </td>
                    <td className={styles.amountCell}>{exp.amount.toLocaleString('en-US')} {exp.currency === 'IQD' ? 'د.ع' : '$'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        {exp.isArchived ? (
                          <button className={styles.editBtn} onClick={() => handleRestore(exp.id)} title="استعادة">🔓</button>
                        ) : (
                          <>
                            <button className={styles.editBtn} onClick={() => handleEdit(exp)} title="تعديل">✏️</button>
                            <button className={styles.archiveBtn} onClick={() => handleArchive(exp.id)} title="أرشفة">📦</button>
                          </>
                        )}
                        <button className={styles.deleteBtn} onClick={() => setDeleteConfirmId(exp.id)} title="حذف">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAndSearched.length === 0 && !loading && <div className={styles.emptyState}><span className={styles.emptyIcon}>📉</span><p>لا توجد نتائج مطابقة</p></div>}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3 className={styles.modalTitle}>تأكيد الحذف</h3>
            <p className={styles.modalText}>هل أنت متأكد من حذف هذه العملية؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className={styles.modalActions}>
              <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(deleteConfirmId)}>تأكيد الحذف</button>
              <button className={styles.cancelDeleteBtn} onClick={() => setDeleteConfirmId(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Attachment Viewer Modal (Gallery) */}
      {activeImagesList && activeImagesList.length > 0 && (
        <div className={styles.modalOverlay} onClick={() => setActiveImagesList(null)}>
          <div className={styles.imageModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.galleryContainer}>
              {activeImagesList.map((url, idx) => (
                <div key={idx} className={styles.galleryItem}>
                  <img src={url} alt={`Attachment ${idx + 1}`} className={styles.fullImage} />
                  <span className={styles.galleryCounter}>صورة {idx + 1} من {activeImagesList.length}</span>
                </div>
              ))}
            </div>
            <button className={styles.closeImageModalBtn} onClick={() => setActiveImagesList(null)}>❌ إغلاق المعاينة</button>
          </div>
        </div>
      )}
    </div>
  );
}
