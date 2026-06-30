"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../../lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, addDoc, onSnapshot, orderBy, deleteDoc } from 'firebase/firestore';

// Types
interface ProductData {
  id: string;
  name: string;
  trackingCode: string;
}

interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  spend: number;
}

interface ReportRow {
  productId: string;
  productName: string;
  accountName: string;
  trackingCode: string;
  matchedCampaigns?: number;
  totalSpend: number;
  validOrdersCount: number;
  deliveredOrdersCount?: number;
  cpa: number;
  netCpo?: number;
}

interface HourSnap {
  hour: number;
  hasData: boolean;
  totalSpend: number;
  totalOrders: number;
  cpa: number;
  products: ReportRow[];
  timestamp: any;
}

export default function UnifiedCPOControlCenter() {
  const [activeTab, setActiveTab] = useState<'live' | 'flashback' | 'archive'>('live');

  // ==========================================
  // ⚙️ General Settings Modal State
  // ==========================================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [alertInterval, setAlertInterval] = useState(60);

  // Load alert settings when modal opens or on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'alerts_settings', 'cpo_alerts');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAlertActive(data.isActive || false);
          setAlertInterval(Math.max(60, data.intervalMinutes || 60));
        }
      } catch (err) {
        console.error("Error fetching alert settings:", err);
      } finally {
        setIsSettingsLoading(false);
      }
    };
    fetchSettings();
  }, [isSettingsOpen]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alertInterval < 60) {
      alert('الحد الأدنى المسموح به هو 60 دقيقة لحماية حساباتك الإعلانية من الحظر.');
      return;
    }
    setIsSettingsSaving(true);
    try {
      const docRef = doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'alerts_settings', 'cpo_alerts');
      await setDoc(docRef, {
        isActive: alertActive,
        intervalMinutes: Number(alertInterval),
        updatedAt: new Date()
      });
      alert('تم حفظ إعدادات الأرشفة بنجاح!');
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Error saving alert settings:", err);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSettingsSaving(false);
    }
  };

  // ==========================================
  // 📊 Tab 1: Live Reports State & Logic
  // ==========================================
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [liveAccounts, setLiveAccounts] = useState<any[]>([]);
  const [hasLiveAccounts, setHasLiveAccounts] = useState<boolean>(false);
  const [liveReportData, setLiveReportData] = useState<ReportRow[]>([]);
  const [liveFetchErrors, setLiveFetchErrors] = useState<string[]>([]);
  
  const [liveSinceDate, setLiveSinceDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [liveUntilDate, setLiveUntilDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Fetch Meta accounts on load
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const querySnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts'));
        if (!querySnap.empty) {
          setHasLiveAccounts(true);
          const allAccs = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const active = allAccs.filter((a: any) => a.isActive !== false);
          setLiveAccounts(active);
        } else {
          setHasLiveAccounts(false);
          setLiveAccounts([]);
        }
      } catch (err) {
        console.error("Error fetching meta accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const generateLiveReport = async () => {
    setIsLiveLoading(true);
    setLiveFetchErrors([]);
    try {
      const querySnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'meta_api_accounts'));
      const allAccs = querySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const active = allAccs.filter(a => a.isActive !== false);

      if (allAccs.length === 0) {
        alert("⚠️ الرجاء إعداد وتفعيل بوابة الربط (Meta Ads API) أولاً وإضافة حساب إعلاني واحد على الأقل.");
        setIsLiveLoading(false);
        return;
      }

      if (active.length === 0) {
        alert("⚠️ جميع حسابات الربط معطلة حالياً. يرجى تفعيل حساب واحد على الأقل من بوابة الربط.");
        setIsLiveLoading(false);
        return;
      }

      setHasLiveAccounts(true);
      setLiveAccounts(active);

      const categoriesSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'categories'));
      const categoriesDb = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const pagesSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'pages_stores'));
      const pagesDb = pagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const productsSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'));
      const groupedTrackedMap = new Map<string, { trackingCode: string, productIds: string[], productNames: string[] }>();
      const allProductsMap = new Map<string, any>();
      
      productsSnap.forEach(doc => {
        const data = doc.data();
        const pNameClean = data.name?.trim().toLowerCase();
        if (pNameClean) {
          const isPageName = pagesDb.some(page => page.name?.trim().toLowerCase() === pNameClean);
          const isMainCatName = categoriesDb.some(cat => cat.name?.trim().toLowerCase() === pNameClean);
          const isSubCatName = categoriesDb.some(cat => 
            cat.subcategories?.some((sub: any) => sub.name?.trim().toLowerCase() === pNameClean)
          );
          if (isPageName || isMainCatName || isSubCatName) return; 
        }

        allProductsMap.set(doc.id, { id: doc.id, ...data });
        const tCode = data.trackingCode?.trim();
        if (tCode && tCode !== '') {
          const key = tCode.toLowerCase();
          if (!groupedTrackedMap.has(key)) {
            groupedTrackedMap.set(key, { trackingCode: tCode, productIds: [], productNames: [] });
          }
          const group = groupedTrackedMap.get(key)!;
          group.productIds.push(doc.id);
          group.productNames.push(data.name);
        }
      });

      const compProductsSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'composite_products'));
      compProductsSnap.forEach(doc => {
        const data = doc.data();
        allProductsMap.set(doc.id, { id: doc.id, isComposite: true, ...data });
        const tCode = data.trackingCode?.trim();
        if (tCode && tCode !== '') {
          const key = tCode.toLowerCase();
          if (!groupedTrackedMap.has(key)) {
            groupedTrackedMap.set(key, { trackingCode: tCode, productIds: [], productNames: [] });
          }
          const group = groupedTrackedMap.get(key)!;
          group.productIds.push(doc.id);
          group.productNames.push(data.name);
        }
      });

      const trackedProducts = Array.from(groupedTrackedMap.values()).sort(
        (a: any, b: any) => b.trackingCode.length - a.trackingCode.length
      ) as any[];

      if (trackedProducts.length === 0) {
        alert("لم يتم العثور على أي منتجات تحتوي على كود تتبع (CPO). الرجاء إضافتها من صفحة المنتجات.");
        setIsLiveLoading(false);
        return;
      }

      const ordersSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'orders'));
      const validOrdersCountByProduct = new Map<string, Set<string>>();
      const deliveredOrdersCountByProduct = new Map<string, Set<string>>();
      
      const sDateObj = new Date(liveSinceDate);
      const uDateObj = new Date(liveUntilDate);
      uDateObj.setHours(23, 59, 59, 999);

      ordersSnap.forEach(doc => {
        const order = { id: doc.id, ...doc.data() } as any;
        let orderDate = new Date();
        if (order.createdAt?.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.addDate) {
          orderDate = new Date(order.addDate);
        }

        if (orderDate >= sDateObj && orderDate <= uDateObj) {
           const status = order.status || 'pending';
           const isCancelledOrReturned = ['cancelled', 'returned'].includes(status);
           const isDelivered = status === 'delivered' || status === 'partial';
           const isValid = !isCancelledOrReturned;

           if (order.items && Array.isArray(order.items)) {
             order.items.forEach((item: any) => {
                const prodId = item.productId || item.id;
                if (!prodId) return;

                if (isValid) {
                   if (!validOrdersCountByProduct.has(prodId)) validOrdersCountByProduct.set(prodId, new Set());
                   validOrdersCountByProduct.get(prodId)!.add(order.id);
                }

                if (isDelivered) {
                   if (!deliveredOrdersCountByProduct.has(prodId)) deliveredOrdersCountByProduct.set(prodId, new Set());
                   deliveredOrdersCountByProduct.get(prodId)!.add(order.id);
                }
             });
           }
        }
      });

      const allCampaignsByAccount = await Promise.all(active.map(async (account: any) => {
        try {
          const res = await fetch('/api/meta-campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: account.accessToken,
              adAccountId: account.adAccountId,
              since: liveSinceDate,
              until: liveUntilDate
            })
          });
          const data = await res.json();
          if (res.ok) {
            return {
              accountName: account.name,
              campaigns: data.campaigns || [],
              error: null
            };
          } else {
            return {
              accountName: account.name,
              campaigns: [],
              error: data.error || 'استجابة غير صحيحة من السيرفر'
            };
          }
        } catch (e: any) {
          return {
            accountName: account.name,
            campaigns: [],
            error: e.message || 'خطأ في شبكة الاتصال'
          };
        }
      }));

      const errorsList: string[] = [];
      allCampaignsByAccount.forEach(acc => {
        if (acc.error) {
          errorsList.push(`${acc.accountName}: ${acc.error}`);
        }
      });
      setLiveFetchErrors(errorsList);

      const finalReport: ReportRow[] = [];
      
      // Track already matched campaigns per account to prevent double counting spend
      const matchedCampaignsByAccount = new Map<string, Set<string>>();
      allCampaignsByAccount.forEach(acc => {
        matchedCampaignsByAccount.set(acc.accountName, new Set<string>());
      });

      trackedProducts.forEach(product => {
        const tCode = product.trackingCode.toLowerCase();

        const matchedOrderIds = new Set<string>();
        const matchedDeliveredOrderIds = new Set<string>();
        
        product.productIds.forEach((prodId: string) => {
          const vOrders = validOrdersCountByProduct.get(prodId);
          if (vOrders) vOrders.forEach(id => matchedOrderIds.add(id));
          
          const dOrders = deliveredOrdersCountByProduct.get(prodId);
          if (dOrders) dOrders.forEach(id => matchedDeliveredOrderIds.add(id));
        });

        const validOrders = matchedOrderIds.size;
        const deliveredOrders = matchedDeliveredOrderIds.size;

        allCampaignsByAccount.forEach(accData => {
          const matchedSet = matchedCampaignsByAccount.get(accData.accountName)!;
          const matched = accData.campaigns.filter((c: any) => {
            const campaignKey = c.campaign_id || c.id;
            if (matchedSet.has(campaignKey)) return false; // Already matched for this account
            
            const cName = c.campaign_name.toLowerCase();
            const isMatch = cName.includes(tCode) || cName.includes(`[${tCode}]`);
            if (isMatch) {
              matchedSet.add(campaignKey);
            }
            return isMatch;
          });

          const totalSpend = matched.reduce((sum: number, c: any) => sum + c.spend, 0);
          
          if (matched.length > 0 || totalSpend > 0) {
            const cpa = validOrders > 0 ? (totalSpend / validOrders) : (totalSpend > 0 ? -1 : 0);
            const netCpo = deliveredOrders > 0 ? (totalSpend / deliveredOrders) : (totalSpend > 0 ? -1 : 0);

            finalReport.push({
              productId: product.trackingCode,
              productName: product.productNames.join(" + "),
              accountName: accData.accountName,
              trackingCode: product.trackingCode,
              matchedCampaigns: matched.length,
              totalSpend,
              validOrdersCount: validOrders,
              deliveredOrdersCount: deliveredOrders,
              cpa,
              netCpo
            });
          }
        });
      });

      finalReport.sort((a, b) => b.totalSpend - a.totalSpend);
      setLiveReportData(finalReport);

    } catch (err: any) {
      console.error("Error generating report:", err);
      alert("حدث خطأ أثناء جلب البيانات: " + err.message);
    } finally {
      setIsLiveLoading(false);
    }
  };

  const handleManualArchive = async () => {
    if (liveReportData.length === 0) {
      alert("⚠️ الرجاء استخراج التقرير المباشر أولاً بالضغط على زر 'استخراج التقرير المباشر' قبل حفظه في الأرشيف.");
      return;
    }

    setIsArchiving(true);
    try {
      const today = new Date();
      const year = today.getFullYear();
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const dayStr = String(today.getDate()).padStart(2, '0');
      
      const yearMonth = `${year}-${monthStr}`;
      const dayKey = `${yearMonth}-${dayStr}`;

      // Build text summary for CAPI style reports
      let reportText = `📊 *تحديث تقارير التكلفة (CPO) اليومية (حفظ يدوي)*\n📅 التاريخ: ${today.toLocaleDateString('ar-IQ')}\n⏰ الوقت: ${today.toLocaleTimeString('ar-IQ')}\n\n`;
      
      liveReportData.forEach(row => {
        const formattedSpend = row.totalSpend.toFixed(2) + '$';
        const formattedCpa = row.cpa === -1 ? '∞' : row.cpa.toFixed(2) + '$';

        reportText += `📦 الصنف: *${row.productName}*\n`;
        reportText += `🔗 الحساب: ${row.accountName}\n`;
        reportText += `💸 الإنفاق: ${formattedSpend}\n`;
        reportText += `📝 الطلبات الصالحة: ${row.validOrdersCount}\n`;
        reportText += `🎯 تكلفة الطلب (CPA): *${formattedCpa}*\n`;
        reportText += `--------------------------\n`;
      });

      // Save directly to Firestore reports_archive collection
      const archiveRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'reports_archive');
      await addDoc(archiveRef, {
        month: yearMonth,
        day: dayKey,
        timestamp: new Date(),
        data: liveReportData,
        summaryText: reportText
      });

      alert("✅ تم بنجاح حفظ وأرشفة التقرير المعروض حالياً على الشاشة!");
    } catch (err: any) {
      console.error("Error archiving manually:", err);
      alert("⚠️ فشل الأرشفة اليدوية: " + err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا التقرير نهائياً من الأرشيف؟")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser?.uid || 'anonymous', 'reports_archive', reportId));
      alert("✅ تم حذف التقرير بنجاح!");
    } catch (err: any) {
      console.error("Error deleting report:", err);
      alert("⚠️ فشل حذف التقرير: " + err.message);
    }
  };

  const formatCurrency = (val: number) => {
    if (val === -1) return '∞ (لا يوجد طلبات)';
    if (val === 0) return '0.00$';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // ==========================================
  // 🕒 Tab 2: Flashback State & Logic
  // ==========================================
  const [fbDate, setFbDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [fbSelectedHour, setFbSelectedHour] = useState<number>(() => {
    return new Date().getHours();
  });
  const [fbIsLoading, setFbIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [fbReports, setFbReports] = useState<any[]>([]);
  const [fbTargetCpas, setFbTargetCpas] = useState<Record<string, number>>({});
  const [selectedDesign, setSelectedDesign] = useState<'classic' | 'purple'>('classic');
  const [purpleMetric, setPurpleMetric] = useState<'spend' | 'orders' | 'cpa'>('spend');

  // Load target CPAs
  useEffect(() => {
    const stored = localStorage.getItem('cpo_target_cpas');
    if (stored) {
      try {
        setFbTargetCpas(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveTargetCpa = (productId: string, val: number) => {
    const updated = { ...fbTargetCpas, [productId]: val };
    setFbTargetCpas(updated);
    localStorage.setItem('cpo_target_cpas', JSON.stringify(updated));
  };

  const fetchFlashbackData = async () => {
    setFbIsLoading(true);
    try {
      const archiveRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'reports_archive');
      const q = query(archiveRef, where("day", "==", fbDate));
      const snap = await getDocs(q);
      setFbReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setFbIsLoading(false);
    }
  };

  const seedDemoData = async () => {
    setIsSeeding(true);
    try {
      const productsSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'products'));
      const activeTrackingCodes: { code: string, name: string }[] = [];
      
      productsSnap.forEach(doc => {
        const data = doc.data();
        const code = data.trackingCode?.trim();
        if (code) {
          activeTrackingCodes.push({ code, name: data.name });
        }
      });
      
      const compProductsSnap = await getDocs(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'composite_products'));
      compProductsSnap.forEach(doc => {
        const data = doc.data();
        const code = data.trackingCode?.trim();
        if (code) {
          activeTrackingCodes.push({ code, name: data.name });
        }
      });

      if (activeTrackingCodes.length === 0) {
        activeTrackingCodes.push({ code: 'فيروكس', name: 'منتج فيروكس الأساسي' });
        activeTrackingCodes.push({ code: 'سيروم', name: 'سيروم الحلزون الفاخر' });
      }

      const batchDocs = [];
      const archiveRef = collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'reports_archive');
      const today = new Date();
      
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const currentDayDate = new Date();
        currentDayDate.setDate(today.getDate() - dayOffset);
        
        const year = currentDayDate.getFullYear();
        const monthStr = String(currentDayDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(currentDayDate.getDate()).padStart(2, '0');
        
        const yearMonth = `${year}-${monthStr}`;
        const dayKey = `${yearMonth}-${dayStr}`;
        
        for (let h = 0; h < 24; h++) {
          const snapshotTime = new Date(currentDayDate);
          snapshotTime.setHours(h, 0, 0, 0);
          
          const multiplier = Math.sin((h / 24) * Math.PI);
          const activeMultiplier = multiplier > 0 ? multiplier : 0.05;
          
          let dayFactor = 1.0;
          if (dayOffset === 7) {
            dayFactor = 0.88;
          } else if (dayOffset > 7) {
            dayFactor = 0.85 + (Math.sin(dayOffset) * 0.1);
          } else if (dayOffset < 7 && dayOffset > 0) {
            dayFactor = 0.95 + (Math.sin(dayOffset) * 0.05);
          }
          
          const hourlySpendBase = 15 * activeMultiplier * dayFactor;
          const hourlyOrdersBase = Math.round(12 * activeMultiplier * dayFactor);
          
          const reportData = activeTrackingCodes.map((p, idx) => {
            const prodSpend = hourlySpendBase * (1 + (idx * 0.2));
            const prodOrders = Math.round(hourlyOrdersBase * (1 - (idx * 0.1)));
            const validOrders = prodOrders > 0 ? prodOrders : 0;
            const deliveredOrders = Math.round(validOrders * 0.85);
            
            const cpa = validOrders > 0 ? prodSpend / validOrders : (prodSpend > 0 ? -1 : 0);
            const netCpo = deliveredOrders > 0 ? prodSpend / deliveredOrders : (prodSpend > 0 ? -1 : 0);
            
            return {
              productId: p.code,
              productName: p.name,
              accountName: `حساب إعلاني ${idx + 1}`,
              trackingCode: p.code,
              matchedCampaigns: 2,
              totalSpend: prodSpend,
              validOrdersCount: validOrders,
              deliveredOrdersCount: deliveredOrders,
              cpa,
              netCpo
            };
          });

          let reportText = `📊 *تحديث تقارير التكلفة (CPO) اليومية (بيانات تجريبية)*\n📅 التاريخ: ${snapshotTime.toLocaleDateString('ar-IQ')}\n⏰ الوقت: ${snapshotTime.toLocaleTimeString('ar-IQ')}\n\n`;
          reportData.forEach(row => {
            reportText += `📦 الصنف: *${row.productName}*\n`;
            reportText += `💸 الإنفاق: ${row.totalSpend.toFixed(2)}$\n`;
            reportText += `📝 الطلبات الصالحة: ${row.validOrdersCount}\n`;
            reportText += `🎯 تكلفة الطلب (CPA): ${row.cpa === -1 ? '∞' : row.cpa.toFixed(2) + '$'}\n`;
            reportText += `--------------------------\n`;
          });
          
          batchDocs.push({
            month: yearMonth,
            day: dayKey,
            timestamp: snapshotTime,
            data: reportData,
            summaryText: reportText
          });
        }
      }
      
      const promises = batchDocs.map(docData => addDoc(archiveRef, docData));
      await Promise.all(promises);
      
      alert(`✅ تم توليد بيانات تجريبية لـ 14 يوماً بنجاح (إجمالي ${batchDocs.length} لقطة زمنيّة). يمكنك الآن المقارنة التاريخية بالفلاش باك.`);
      fetchFlashbackData();
    } catch (err: any) {
      console.error("Error seeding CPO data:", err);
      alert("⚠️ فشل توليد البيانات: " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'flashback') {
      fetchFlashbackData();
    }
  }, [fbDate, activeTab]);

  const profile = useMemo(() => buildProfile(fbReports), [fbReports]);
  const activeSnap = profile[fbSelectedHour];

  const getHourTrend = (h: number) => {
    if (h === 0) return null;
    const currentCpa = profile[h].cpa;
    const prevCpa = profile[h - 1].cpa;
    if (currentCpa === 0 || prevCpa === 0 || currentCpa === -1 || prevCpa === -1) return null;
    if (currentCpa < prevCpa) return { direction: 'down', icon: '▼', color: '#10b981' }; // CPA went down
    if (currentCpa > prevCpa) return { direction: 'up', icon: '▲', color: '#ef4444' };   // CPA went up
    return null;
  };

  const renderSpendSparkline = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    let maxHrSpend = 1;
    hours.forEach(h => {
      if (profile[h].totalSpend > maxHrSpend) maxHrSpend = profile[h].totalSpend;
    });
    
    const width = 120;
    const height = 30;
    const padding = 2;
    
    const points = hours.map(h => {
      const x = padding + (h * (width - padding * 2)) / 23;
      const y = height - padding - (profile[h].totalSpend / maxHrSpend) * (height - padding * 2);
      return `${x},${y}`;
    });
    
    return (
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>
    );
  };

  // Mixed chart logic
  const chartHeight = 240;
  const chartWidth = 1000;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 20;
  const paddingBottom = 30;

  const flashbackChartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    let maxSpend = 10;
    let maxOrders = 5;
    let maxCpa = 10;
    
    hours.forEach(h => {
      if (profile[h].totalSpend > maxSpend) maxSpend = profile[h].totalSpend;
      if (profile[h].totalOrders > maxOrders) maxOrders = profile[h].totalOrders;
      if (profile[h].cpa > maxCpa) maxCpa = profile[h].cpa;
    });

    maxSpend = Math.ceil(maxSpend * 1.15) || 10;
    maxOrders = Math.ceil(maxOrders * 1.15) || 5;
    maxCpa = Math.ceil(maxCpa * 1.15) || 10;

    const points = hours.map(h => {
      const spend = profile[h].totalSpend;
      const orders = profile[h].totalOrders;
      const cpa = profile[h].cpa;
      
      const x = paddingLeft + (h * (chartWidth - paddingLeft - paddingRight)) / 23;
      const ySpend = chartHeight - paddingBottom - (spend / maxSpend) * (chartHeight - paddingTop - paddingBottom);
      const yOrders = chartHeight - paddingBottom - (orders / maxOrders) * (chartHeight - paddingTop - paddingBottom);
      const yCpa = chartHeight - paddingBottom - (cpa === -1 ? 0 : (cpa / maxCpa) * (chartHeight - paddingTop - paddingBottom));

      return {
        hour: h,
        x,
        ySpend,
        yOrders,
        yCpa,
        spend,
        orders,
        cpa,
        hasData: profile[h].hasData
      };
    });

    const activePoints = points.filter(pt => pt.hasData && (pt.spend > 0 || pt.orders > 0));

    return { points, activePoints, maxSpend, maxOrders, maxCpa };
  }, [profile]);

  const purplePoints = useMemo(() => {
    return flashbackChartData.points.map(pt => {
      let y = pt.ySpend;
      if (purpleMetric === 'orders') y = pt.yOrders;
      if (purpleMetric === 'cpa') y = pt.yCpa;
      return { x: pt.x, y };
    });
  }, [flashbackChartData.points, purpleMetric]);

  const getBezierPath = (pts: {x: number, y: number}[]) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = useMemo(() => getBezierPath(purplePoints), [purplePoints]);
  const fillPath = useMemo(() => {
    if (purplePoints.length === 0) return '';
    return `${linePath} L ${purplePoints[purplePoints.length - 1].x} ${chartHeight - paddingBottom} L ${purplePoints[0].x} ${chartHeight - paddingBottom} Z`;
  }, [purplePoints, linePath]);

  const flashbackProductIds = useMemo(() => {
    const set = new Set<string>();
    activeSnap.products.forEach(p => set.add(p.productId));
    return Array.from(set);
  }, [activeSnap]);

  const hasFlashbackData = fbReports.length > 0;

  // ==========================================
  // 📂 Tab 3: Archive State & Logic
  // ==========================================
  const [archiveReports, setArchiveReports] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveView, setArchiveView] = useState<'months' | 'days' | 'reports'>('months');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users', auth.currentUser?.uid || 'anonymous', 'reports_archive'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArchiveReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setArchiveLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const months = useMemo(() => {
    return Array.from(new Set(archiveReports.map(r => r.month))).filter(Boolean);
  }, [archiveReports]);

  const daysInMonth = useMemo(() => {
    return selectedMonth 
      ? Array.from(new Set(archiveReports.filter(r => r.month === selectedMonth).map(r => r.day))).filter(Boolean)
      : [];
  }, [selectedMonth, archiveReports]);

  const reportsInDay = useMemo(() => {
    return selectedDay 
      ? archiveReports.filter(r => r.day === selectedDay)
      : [];
  }, [selectedDay, archiveReports]);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.title}>
            <span>📊 مركز إدارة وتقارير تكلفة الطلب (CPO Control Center)</span>
          </div>
          <button className={styles.settingsBtn} onClick={() => setIsSettingsOpen(true)} title="إعدادات الأرشفة والجدولة">
            ⚙️
          </button>
        </div>
        <p className={styles.subtitle}>شاشة موحدة لمراجعة تكاليف الإعلانات ومطابقتها مع الطلبات، وتصفح الأرشيف والمقارنات التاريخية.</p>
        
        {/* Navigation Tabs */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'live' ? styles.active : ''}`}
            onClick={() => setActiveTab('live')}
          >
            📊 التقارير المباشرة
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'flashback' ? styles.active : ''}`}
            onClick={() => setActiveTab('flashback')}
          >
            🕒 تحليل الفلاش باك (Flashback)
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'archive' ? styles.active : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            📂 أرشيف التقارير الذكية
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 📊 Tab 1: Live Reports View */}
      {/* ========================================================= */}
      {activeTab === 'live' && (
        <div className={styles.contentWrapper}>
          <div className={styles.headerActions} style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
            <div className={styles.dateGroup}>
              <span className={styles.dateLabel}>من:</span>
              <input 
                type="date" 
                className={styles.dateInput}
                value={liveSinceDate} 
                onChange={(e) => setLiveSinceDate(e.target.value)} 
              />
            </div>
            <div className={styles.dateGroup}>
              <span className={styles.dateLabel}>إلى:</span>
              <input 
                type="date" 
                className={styles.dateInput}
                value={liveUntilDate} 
                onChange={(e) => setLiveUntilDate(e.target.value)}
              />
            </div>
            <button 
              className={styles.fetchButton} 
              onClick={generateLiveReport}
              disabled={isLiveLoading || isArchiving}
            >
              {isLiveLoading ? 'جاري التحليل والمطابقة...' : '🔄 استخراج التقرير المباشر'}
            </button>
            <button 
              className={styles.fetchButton} 
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', marginRight: 'auto' }}
              onClick={handleManualArchive} 
              disabled={isArchiving || isLiveLoading}
            >
              {isArchiving ? '⏳ جاري الحفظ...' : '📸 أرشفة الأداء الحالي الآن'}
            </button>
          </div>

          {liveFetchErrors.length > 0 && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '8px', direction: 'rtl' }}>
              <strong>⚠️ تنبيه: فشل جلب البيانات لبعض الحسابات الإعلانية:</strong>
              <ul style={{ marginTop: '0.5rem', marginRight: '1.5rem', listStyleType: 'disc', fontSize: '0.9rem' }}>
                {liveFetchErrors.map((err, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {!hasLiveAccounts && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '8px' }}>
              ⚠️ <strong>تنبيه:</strong> لم يتم العثور على أي حسابات ربط مضافة. يرجى تهيئة حسابات ميتا الإعلانية في إعدادات المنصة لتتمكن من تشغيل التقارير.
            </div>
          )}

          {isLiveLoading ? (
            <div className={styles.statusOverlay}>
              <div className={styles.spinner}></div>
              <p>جاري مطابقة الأكواد مع حسابات فيسبوك الإعلانية...</p>
            </div>
          ) : liveReportData.length > 0 ? (
            <>
              {/* Summary Cards */}
              <div className={styles.infoCards}>
                <div className={styles.infoCard}>
                  <span className={styles.infoCardTitle}>إجمالي إنفاق الحملات المطابقة</span>
                  <span className={styles.infoCardValue}>
                    {formatCurrency(liveReportData.reduce((sum, row) => sum + row.totalSpend, 0))}
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <span className={styles.infoCardTitle}>إجمالي الطلبات الصالحة</span>
                  <span className={`${styles.infoCardValue} ${styles.accent}`}>
                    {liveReportData.reduce((sum, row) => sum + row.validOrdersCount, 0)} طلب
                  </span>
                </div>
                <div className={styles.infoCard}>
                  <span className={styles.infoCardTitle}>متوسط تكلفة الاستحواذ (CPA)</span>
                  <span className={styles.infoCardValue} style={{ color: '#3b82f6' }}>
                    {(() => {
                      const tSpend = liveReportData.reduce((sum, row) => sum + row.totalSpend, 0);
                      const tOrders = liveReportData.reduce((sum, row) => sum + row.validOrdersCount, 0);
                      return tOrders > 0 ? formatCurrency(tSpend / tOrders) : '0.00$';
                    })()}
                  </span>
                </div>
              </div>

              {/* Data Table */}
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الحساب الإعلاني</th>
                      <th>كود التتبع</th>
                      <th>الحملات المطابقة</th>
                      <th>إجمالي الإنفاق</th>
                      <th>الطلبات الصالحة</th>
                      <th>تكلفة الاستحواذ (CPA)</th>
                      <th>الطلبات المكتملة</th>
                      <th>صافي التكلفة (Net CPO)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveReportData.map((row, idx) => (
                      <tr key={`${row.productId}-${row.accountName}-${idx}`}>
                        <td style={{ fontWeight: 'bold', color: '#fff' }}>{row.productName}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{row.accountName}</td>
                        <td><span className={styles.trackingBadge}>{row.trackingCode}</span></td>
                        <td>{row.matchedCampaigns}</td>
                        <td style={{ color: '#f87171', fontWeight: 'bold' }}>
                          {formatCurrency(row.totalSpend)}
                        </td>
                        <td>{row.validOrdersCount}</td>
                        <td className={styles.metricSecondary}>
                          {formatCurrency(row.cpa)}
                        </td>
                        <td>{row.deliveredOrdersCount}</td>
                        <td className={styles.metricPrimary}>
                          {formatCurrency(row.netCpo || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>📊</div>
              <h3>بانتظار استخراج التقرير</h3>
              <p>حدد تاريخ البداية والنهاية ثم اضغط على "استخراج التقرير المباشر" لمزامنة البيانات الآن.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 🕒 Tab 2: Flashback View */}
      {/* ========================================================= */}
      {activeTab === 'flashback' && (
        <div>
          {/* Timeline and Dates Controls */}
          <div className={styles.timelineCard} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className={styles.headerActions} style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div className={styles.dateGroup}>
                <span className={styles.dateLabel}>اليوم المختار:</span>
                <input 
                  type="date" 
                  className={styles.dateInput} 
                  value={fbDate} 
                  onChange={(e) => setFbDate(e.target.value)} 
                />
              </div>
              <button className={styles.fetchButton} onClick={fetchFlashbackData} disabled={fbIsLoading}>
                🔄 تحديث البيانات
              </button>
            </div>

            <div className={styles.timelineHeader}>
              <span className={styles.timelineTitle}>⏱️ شريط التحكم بالزمن (Time Slider)</span>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>الساعة المحددة:</span>
                <span className={styles.selectedHourBadge}>{String(fbSelectedHour).padStart(2, '0')}:00</span>
              </div>
            </div>

            <div className={styles.sliderContainer}>
              <input 
                type="range" 
                min="0" 
                max="23" 
                value={fbSelectedHour}
                onChange={(e) => setFbSelectedHour(Number(e.target.value))}
                className={styles.rangeInput}
              />
              <div className={styles.sliderTicks}>
                {Array.from({ length: 24 }).map((_, h) => {
                  return (
                    <span 
                      key={h} 
                      className={`${styles.tick} ${fbSelectedHour === h ? styles.active : ''}`}
                      onClick={() => setFbSelectedHour(h)}
                    >
                      {String(h).padStart(2, '0')}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {fbIsLoading ? (
            <div className={styles.statusOverlay}>
              <div className={styles.spinner}></div>
              <p>جاري سحب لقطات الأرشيف الزمني...</p>
            </div>
          ) : !hasFlashbackData ? (
            <div className={styles.statusOverlay}>
              <div className={styles.emptyIcon}>📂</div>
              <h3>لا توجد لقطات مؤرشفة لليوم المحدد</h3>
              <p>يرجى اختيار تاريخ آخر يحتوي على لقطات محفوظة أو تفعيل الأرشفة التلقائية لحفظ الأرقام بشكل دوري.</p>
            </div>
          ) : (
            <>
              {/* 🎯 Summary Card for the Entire Day */}
              <div className={styles.daySummaryCard}>
                <div className={styles.daySummaryHeader}>
                  <span className={styles.daySummaryTitle}>📊 ملخص أداء اليوم بالكامل (24 ساعة)</span>
                  <span className={styles.daySummaryBadge}>اليوم المختار: {fbDate}</span>
                </div>
                <div className={styles.daySummaryGrid}>
                  <div className={styles.daySummaryItem}>
                    <span className={styles.daySummaryLabel}>إجمالي الطلبات (Total Orders)</span>
                    <strong className={styles.daySummaryValue} style={{ color: '#3b82f6' }}>
                      {profile[23].totalOrders} طلب
                    </strong>
                  </div>
                  <div className={styles.daySummaryItem}>
                    <span className={styles.daySummaryLabel}>متوسط تكلفة الاستحواذ (Average CPA)</span>
                    <strong className={styles.daySummaryValue} style={{ color: '#10b981' }}>
                      {profile[23].cpa === -1 ? '∞' : formatCurrency(profile[23].cpa)}
                    </strong>
                  </div>
                  <div className={styles.daySummaryItem}>
                    <span className={styles.daySummaryLabel}>إجمالي الميزانية المصروفة (Total Spend)</span>
                    <strong className={styles.daySummaryValue} style={{ color: '#c084fc' }}>
                      {formatCurrency(profile[23].totalSpend)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 📊 Premium KPI Cards Row */}
              <div className={styles.kpiCardsRow}>
                {/* Card 1: Total Orders */}
                <div className={`${styles.kpiCard} ${styles.kpiCardNeutral}`}>
                  <span className={styles.kpiCardTitle}>إجمالي الطلبات (Total Orders)</span>
                  <div className={styles.kpiCardMainRow}>
                    <span className={styles.kpiCardValue}>{activeSnap.totalOrders}</span>
                  </div>
                  <span className={styles.kpiCardDesc}>شرح: "شكد بعنا باليوم والساعة المحددة؟"</span>
                </div>

                {/* Card 2: Average CPA */}
                <div className={`${styles.kpiCard} ${styles.kpiCardNeutral}`}>
                  <span className={styles.kpiCardTitle}>متوسط تكلفة الطلب (Average CPA)</span>
                  <div className={styles.kpiCardMainRow}>
                    <span className={styles.kpiCardValue}>
                      {activeSnap.cpa === -1 ? '∞' : formatCurrency(activeSnap.cpa)}
                    </span>
                  </div>
                  <span className={styles.kpiCardDesc}>شرح: "شكد دندفع حتى نجيب هذا الطلب؟"</span>
                </div>

                {/* Card 3: Total Spend */}
                <div className={`${styles.kpiCard} ${styles.kpiCardNeutral}`}>
                  <span className={styles.kpiCardTitle}>الميزانية المصروفة (Total Spend)</span>
                  <div className={styles.kpiCardMainRow} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={styles.kpiCardValue}>{formatCurrency(activeSnap.totalSpend)}</span>
                    <div className={styles.sparklineContainer}>
                      {renderSpendSparkline()}
                    </div>
                  </div>
                  <span className={styles.kpiCardDesc}>شرح: "شكد حركنا فلوس من الميزانية؟"</span>
                </div>
              </div>

              {/* Mixed Chart & Side comparisons */}
              <div className={styles.dashboardGrid} style={{ gridTemplateColumns: '1fr' }}>
                {selectedDesign === 'classic' ? (
                  /* SVG 3-Axes Chart Card */
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className={styles.chartTitle}>🎯 مؤشر كفاءة الطلب والتكلفة (ساعة بساعة)</span>
                        <select
                          value={selectedDesign}
                          onChange={(e) => setSelectedDesign(e.target.value as 'classic' | 'purple')}
                          style={{
                            backgroundColor: 'var(--surface-hover)',
                            color: '#fff',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="classic">📊 التصميم الكلاسيكي (أعمدة وخطوط)</option>
                          <option value="purple">✨ التصميم البنفسجي المضيء (Purple Line)</option>
                        </select>
                      </div>
                      <div className={styles.chartLegend}>
                        <div className={styles.legendItem}>
                          <span className={styles.legendDot} style={{ backgroundColor: '#8b5cf6' }}></span>
                          <span>ميزانية الإنفاق (أعمدة)</span>
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendDot} style={{ backgroundColor: '#3b82f6', height: '3px', borderRadius: '0' }}></span>
                          <span>عدد الطلبات (خط أزرق)</span>
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendDot} style={{ backgroundColor: '#10b981', height: '3px', borderRadius: '0' }}></span>
                          <span>مؤشر CPA (خط أخضر)</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.svgWrapper}>
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.svg} preserveAspectRatio="none">
                        {/* Left Y-axis Grid Lines (Spend) */}
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const ratio = idx / 4;
                          const y = chartHeight - paddingBottom - ratio * (chartHeight - paddingTop - paddingBottom);
                          const spendVal = Math.round(ratio * flashbackChartData.maxSpend);
                          
                          return (
                            <g key={`spendGrid-${idx}`}>
                              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} className={styles.svgGridLine} />
                              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className={styles.svgText}>
                                {spendVal}$
                              </text>
                            </g>
                          );
                        })}

                        {/* Right Y-axis Labels (Orders) */}
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const ratio = idx / 4;
                          const y = chartHeight - paddingBottom - ratio * (chartHeight - paddingTop - paddingBottom);
                          const ordersVal = Math.round(ratio * flashbackChartData.maxOrders);
                          
                          return (
                            <g key={`ordersGrid-${idx}`}>
                              <text x={chartWidth - paddingRight + 8} y={y + 4} textAnchor="start" className={styles.svgText}>
                                {ordersVal} ط
                              </text>
                            </g>
                          );
                        })}

                        {/* X Axis Hours */}
                        {flashbackChartData.points.map((pt, idx) => {
                          return (
                            <text key={idx} x={pt.x} y={chartHeight - 8} textAnchor="middle" className={styles.svgText}>
                              {String(pt.hour).padStart(2, '0')}:00
                            </text>
                          );
                        })}

                        {/* Spend columns (Left axis) */}
                        {flashbackChartData.points.map((pt) => {
                          const barWidth = 16;
                          const heightSpend = chartHeight - paddingBottom - pt.ySpend;
                          const isSelected = fbSelectedHour === pt.hour || hoveredHour === pt.hour;
                          return (
                            <rect 
                              key={`barSpend-${pt.hour}`}
                              x={pt.x - barWidth / 2} 
                              y={pt.ySpend} 
                              width={barWidth} 
                              height={Math.max(0, heightSpend)} 
                              fill="#8b5cf6"
                              opacity={isSelected ? 0.9 : 0.4}
                              rx="2"
                            />
                          );
                        })}

                        {/* Orders Path (Right axis) */}
                        {flashbackChartData.points.length > 1 && (
                          <path
                            d={flashbackChartData.points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.yOrders}`).join(' ')}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2.5"
                            opacity="0.8"
                          />
                        )}

                        {/* CPA Path (Green line) */}
                        {flashbackChartData.points.length > 1 && (
                          <path
                            d={flashbackChartData.points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.yCpa}`).join(' ')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            opacity="0.9"
                          />
                        )}

                        {/* Points and Hover Zones */}
                        {flashbackChartData.points.map((pt) => {
                          const isSelected = fbSelectedHour === pt.hour || hoveredHour === pt.hour;
                          const shouldShowDots = (pt.hasData && (pt.spend > 0 || pt.orders > 0)) || isSelected;
                          return (
                            <g key={`interactive-${pt.hour}`}>
                              {/* Tiny dots on lines */}
                              {shouldShowDots && (
                                <>
                                  <circle 
                                    cx={pt.x} 
                                    cy={pt.yCpa} 
                                    r={isSelected ? 5 : 3} 
                                    fill="#10b981" 
                                    stroke={isSelected ? "#fff" : "none"}
                                    strokeWidth="1.5"
                                  />
                                  <circle 
                                    cx={pt.x} 
                                    cy={pt.yOrders} 
                                    r={isSelected ? 5 : 3} 
                                    fill="#3b82f6" 
                                    stroke={isSelected ? "#fff" : "none"}
                                    strokeWidth="1.5"
                                  />
                                </>
                              )}

                              {/* Hover capture rectangles */}
                              <rect
                                x={pt.x - 15}
                                y={paddingTop}
                                width="30"
                                height={chartHeight - paddingTop - paddingBottom}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                onMouseLeave={() => setHoveredHour(null)}
                                onClick={() => setFbSelectedHour(pt.hour)}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Floating Tooltip card */}
                      {(() => {
                        const activeHour = hoveredHour !== null ? hoveredHour : fbSelectedHour;
                        const snap = profile[activeHour];
                        const pt = flashbackChartData.points[activeHour];
                        if (!snap) return null;
                        
                        return (
                          <div 
                            className={styles.chartTooltip}
                            style={{
                              position: 'absolute',
                              left: `${(pt.x / chartWidth) * 100}%`,
                              top: `${(Math.min(pt.yCpa, pt.yOrders) / chartHeight) * 100}%`,
                              transform: 'translate(-50%, -105%)',
                              pointerEvents: 'none',
                              zIndex: 10
                            }}
                          >
                            <div className={styles.tooltipTime}>🕒 الساعة {String(activeHour).padStart(2, '0')}:00</div>
                            <div className={styles.tooltipRow}>
                              <span>📝 الطلبات:</span>
                              <strong>{snap.totalOrders} طلب</strong>
                            </div>
                            <div className={styles.tooltipRow}>
                              <span>💸 الإنفاق:</span>
                              <strong style={{ color: '#f87171' }}>{formatCurrency(snap.totalSpend)}</strong>
                            </div>
                            <div className={styles.tooltipRow}>
                              <span>🎯 تكلفة CPA:</span>
                              <strong style={{ color: '#10b981' }}>{snap.cpa === -1 ? '∞' : formatCurrency(snap.cpa)}</strong>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  /* SVG Purple Line Chart Card (Purple Edition) */
                  <div className={styles.purpleContainer}>
                    <div className={styles.purpleBacklight} />

                    <div className={styles.purpleHeader}>
                      <div className={styles.purpleHeaderLeft}>
                        {/* Icon */}
                        <div className={styles.purpleIconContainer}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 20V10"></path>
                            <path d="M12 20V4"></path>
                            <path d="M6 20V14"></path>
                          </svg>
                        </div>
                        {/* Text */}
                        <div>
                          <p className={styles.purpleHeaderTitle}>
                            {purpleMetric === 'spend' ? 'Your Total Spend (الإنفاق)' : purpleMetric === 'orders' ? 'Your Total Orders (الطلبات)' : 'Your Average CPA (التكلفة)'}
                          </p>
                          <h2 className={styles.purpleHeaderValue}>
                            {purpleMetric === 'spend' 
                              ? formatCurrency(activeSnap.totalSpend) 
                              : purpleMetric === 'orders' 
                                ? `${activeSnap.totalOrders} طلب` 
                                : activeSnap.cpa === -1 ? '∞' : formatCurrency(activeSnap.cpa)
                            }
                          </h2>
                        </div>
                      </div>

                      {/* Filters */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', position: 'relative', zIndex: 20 }}>
                        <select
                          value={selectedDesign}
                          onChange={(e) => setSelectedDesign(e.target.value as 'classic' | 'purple')}
                          style={{
                            backgroundColor: '#0a0d11',
                            color: '#fff',
                            border: '1px solid rgba(156, 163, 175, 0.1)',
                            borderRadius: '20px',
                            padding: '0.4rem 1rem',
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="classic">📊 التصميم الكلاسيكي (أعمدة وخطوط)</option>
                          <option value="purple">✨ التصميم البنفسجي المضيء (Purple Line)</option>
                        </select>

                        <div className={styles.purpleFilterContainer}>
                          <button 
                            onClick={() => setPurpleMetric('spend')}
                            className={`${styles.purpleFilterBtn} ${purpleMetric === 'spend' ? styles.purpleFilterBtnActive : ''}`}
                          >
                            Spend
                          </button>
                          <button 
                            onClick={() => setPurpleMetric('orders')}
                            className={`${styles.purpleFilterBtn} ${purpleMetric === 'orders' ? styles.purpleFilterBtnActive : ''}`}
                          >
                            Orders
                          </button>
                          <button 
                            onClick={() => setPurpleMetric('cpa')}
                            className={`${styles.purpleFilterBtn} ${purpleMetric === 'cpa' ? styles.purpleFilterBtnActive : ''}`}
                          >
                            CPA
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Chart area */}
                    <div className={styles.purpleSvgWrapper}>
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.svg} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Y-axis Grid Lines */}
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const ratio = idx / 4;
                          const y = chartHeight - paddingBottom - ratio * (chartHeight - paddingTop - paddingBottom);
                          let valStr = '';
                          if (purpleMetric === 'spend') {
                            const maxVal = flashbackChartData.maxSpend;
                            valStr = `${Math.round(ratio * maxVal)}$`;
                          } else if (purpleMetric === 'orders') {
                            const maxVal = flashbackChartData.maxOrders;
                            valStr = `${Math.round(ratio * maxVal)} ط`;
                          } else {
                            const maxVal = flashbackChartData.maxCpa;
                            valStr = `${Math.round(ratio * maxVal)}$`;
                          }
                          
                          return (
                            <g key={`purpleGrid-${idx}`}>
                              <line 
                                x1={paddingLeft} 
                                y1={y} 
                                x2={chartWidth - paddingRight} 
                                y2={y} 
                                stroke="rgba(255, 255, 255, 0.03)" 
                                strokeWidth="1" 
                                strokeDasharray="5,5" 
                              />
                              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className={styles.svgText} fill="#64748b">
                                {valStr}
                              </text>
                            </g>
                          );
                        })}

                        {/* X Axis Hours */}
                        {flashbackChartData.points.map((pt, idx) => {
                          return (
                            <text key={idx} x={pt.x} y={chartHeight - 8} textAnchor="middle" className={styles.svgText} fill="#64748b">
                              {String(pt.hour).padStart(2, '0')}:00
                            </text>
                          );
                        })}

                        {/* Gradient Fill under path */}
                        {fillPath && (
                          <path d={fillPath} fill="url(#purpleGradient)" />
                        )}

                        {/* Glowing Smooth Curve Line */}
                        {linePath && (
                          <path 
                            d={linePath} 
                            fill="none" 
                            stroke="#a855f7" 
                            strokeWidth="3" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0px 0px 8px rgba(168, 85, 247, 0.5))' }}
                          />
                        )}

                        {/* Interactive Hover Zones & Point Indicators */}
                        {flashbackChartData.points.map((pt) => {
                          const isSelected = fbSelectedHour === pt.hour || hoveredHour === pt.hour;
                          const ptY = purplePoints[pt.hour]?.y;
                          const val = purpleMetric === 'spend' ? pt.spend : purpleMetric === 'orders' ? pt.orders : pt.cpa;
                          const shouldShowDot = isSelected || (pt.hasData && val > 0);
                          
                          return (
                            <g key={`purpleInteractive-${pt.hour}`}>
                              {shouldShowDot && ptY !== undefined && (
                                <circle 
                                  cx={pt.x} 
                                  cy={ptY} 
                                  r={isSelected ? 6 : 4} 
                                  fill={isSelected ? '#f3e8ff' : '#13161b'} 
                                  stroke="#a855f7" 
                                  strokeWidth="3"
                                />
                              )}

                              <rect
                                x={pt.x - 15}
                                y={paddingTop}
                                width="30"
                                height={chartHeight - paddingTop - paddingBottom}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                onMouseLeave={() => setHoveredHour(null)}
                                onClick={() => setFbSelectedHour(pt.hour)}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Floating Tooltip card */}
                      {(() => {
                        const activeHour = hoveredHour !== null ? hoveredHour : fbSelectedHour;
                        const snap = profile[activeHour];
                        const pt = flashbackChartData.points[activeHour];
                        if (!snap) return null;
                        
                        return (
                          <div 
                            className={styles.chartTooltip}
                            style={{
                              position: 'absolute',
                              left: `${(pt.x / chartWidth) * 100}%`,
                              top: `${((purplePoints[activeHour]?.y || pt.yCpa) / chartHeight) * 100}%`,
                              transform: 'translate(-50%, -105%)',
                              pointerEvents: 'none',
                              zIndex: 100
                            }}
                          >
                            <div className={styles.tooltipTime}>🕒 الساعة {String(activeHour).padStart(2, '0')}:00</div>
                            <div className={styles.tooltipRow}>
                              <span>📝 الطلبات:</span>
                              <strong>{snap.totalOrders} طلب</strong>
                            </div>
                            <div className={styles.tooltipRow}>
                              <span>💸 الإنفاق:</span>
                              <strong style={{ color: '#f87171' }}>{formatCurrency(snap.totalSpend)}</strong>
                            </div>
                            <div className={styles.tooltipRow}>
                              <span>🎯 تكلفة CPA:</span>
                              <strong style={{ color: '#10b981' }}>{snap.cpa === -1 ? '∞' : formatCurrency(snap.cpa)}</strong>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Product Breakdown Table */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableTitle}>📦 أداء الأصناف التاريخي ساعة بساعة</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* يعرض البيانات التراكمية لليوم حتى الساعة المحددة</span>
                </div>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>الصنف</th>
                        <th>الإنفاق</th>
                        <th>الطلبات الصالحة</th>
                        <th>تكلفة الاستحواذ (CPA)</th>
                        <th>التكلفة المستهدفة (Target)</th>
                        <th>تحليل حالة الأداء والقرارات السريعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flashbackProductIds.map(prodId => {
                        const row = activeSnap.products.find(p => p.productId === prodId);
                        
                        const pName = row?.productName || 'صنف غير معروف';
                        const spend = row?.totalSpend || 0;
                        const orders = row?.validOrdersCount || 0;
                        const cpa = row?.cpa || 0;
                        const target = fbTargetCpas[prodId] || 0;

                        let decision = { text: 'لا يوجد صرف أو طلبات', status: 'normal' };
                        if (spend > 0) {
                          if (orders === 0) {
                            if (spend > 20) {
                              decision = { text: '🔴 خطر! صرف إعلاني مستمر بدون أي طلبات.', status: 'bad' };
                            } else {
                              decision = { text: '🟡 صرف إعلاني منخفض وبلا طلبات بعد. يرجى المراقبة.', status: 'warning' };
                            }
                          } else {
                            if (target > 0) {
                              if (cpa <= target * 0.7) {
                                decision = { text: '🟢 ممتاز! التكلفة أقل بكثير من المستهدفة. زد الصرف.', status: 'good' };
                              } else if (cpa > target) {
                                decision = { text: '🔴 خسارة! التكلفة تجاوزت الحد الأقصى المستهدف. أوقف الحملة.', status: 'bad' };
                              } else {
                                decision = { text: '🟡 أداء مقبول ولكن قريب من الحد الحرج. راقب بعناية.', status: 'warning' };
                              }
                            } else {
                              decision = { text: '⚪ حملة نشطة. حدد التكلفة المستهدفة لتحليل أفضل.', status: 'normal' };
                            }
                          }
                        }

                        return (
                          <tr key={prodId}>
                            <td className={styles.productName}>{pName}</td>
                            <td style={{ color: spend > 0 ? '#f87171' : 'var(--text-muted)' }}>{formatCurrency(spend)}</td>
                            <td style={{ fontWeight: 'bold' }}>{orders}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {cpa > 0 ? (
                                  <span className={`${styles.cpaBadge} ${
                                    target > 0 ? (cpa <= target ? styles.cpaGood : styles.cpaBad) : styles.cpaGood
                                  }`}>
                                    {formatCurrency(cpa)}
                                  </span>
                                ) : spend > 0 ? (
                                  <span className={`${styles.cpaBadge} ${styles.cpaBad}`}>∞ (بلا طلبات)</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0.00$</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <input 
                                  type="number" 
                                  value={target || ''} 
                                  onChange={(e) => saveTargetCpa(prodId, parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  style={{
                                    width: '60px',
                                    padding: '0.25rem',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-hover)',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    fontSize: '0.85rem'
                                  }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>$</span>
                              </div>
                            </td>
                            <td className={
                              decision.status === 'good' ? styles.metricPrimary :
                              decision.status === 'bad' ? styles.metricWarning :
                              styles.recText
                            }>
                              {decision.text}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 📂 Tab 3: Archived Reports View */}
      {/* ========================================================= */}
      {activeTab === 'archive' && (
        <div className={styles.contentWrapper}>
          {/* Breadcrumb */}
          {archiveView !== 'months' && (
            <div className={styles.breadcrumb}>
              <span className={styles.crumbLink} onClick={() => { setSelectedMonth(null); setSelectedDay(null); setArchiveView('months'); }}>الأرشيف (جميع الأشهر)</span>
              {selectedMonth && (
                <>
                  <span> / </span>
                  <span 
                    className={archiveView === 'reports' ? styles.crumbLink : ''} 
                    onClick={() => { setSelectedDay(null); setArchiveView('days'); }}
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

          {archiveLoading ? (
            <div className={styles.statusOverlay}>
              <div className={styles.spinner}></div>
              <p>جاري تحميل أرشيف التقارير...</p>
            </div>
          ) : archiveReports.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📁</div>
              <p>الأرشيف فارغ حالياً. قم بأخذ لقطات وحفظها لتظهر هنا.</p>
            </div>
          ) : (
            <>
              {/* View: Months */}
              {archiveView === 'months' && (
                <div className={styles.foldersGrid}>
                  {months.map(month => {
                    const count = archiveReports.filter(r => r.month === month).length;
                    return (
                      <div key={month} className={styles.folderCard} onClick={() => { setSelectedMonth(month); setArchiveView('days'); }}>
                        <div className={styles.folderIcon}>📁</div>
                        <div className={styles.folderName}>{month}</div>
                        <div className={styles.folderCount}>{count} تقرير</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View: Days */}
              {archiveView === 'days' && (
                <div className={styles.foldersGrid}>
                  {daysInMonth.map(day => {
                    const count = archiveReports.filter(r => r.day === day).length;
                    const dayNumber = day.split('-').pop();
                    return (
                      <div key={day} className={styles.folderCard} onClick={() => { setSelectedDay(day); setArchiveView('reports'); }}>
                        <div className={styles.folderIcon}>📄</div>
                        <div className={styles.folderName}>يوم {dayNumber}</div>
                        <div className={styles.folderCount}>{count} تقرير</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View: Reports list */}
              {archiveView === 'reports' && (
                <div className={styles.reportsList}>
                  {reportsInDay.map(report => (
                    <div key={report.id} className={styles.reportItem}>
                      <div className={styles.reportHeader}>
                        <div className={styles.reportTime}>
                          🕒 {formatTimestamp(report.timestamp)}
                        </div>
                        <div className={styles.reportMeta} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span>عدد المنتجات: {report.data ? report.data.length : 0}</span>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontFamily: 'inherit',
                              fontWeight: 'bold',
                              transition: 'all 0.2s',
                            }}
                            title="حذف التقرير"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </div>
                      <pre className={styles.summaryPre}>
                        {report.summaryText || 'لا يوجد ملخص نصي متوفر'}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ⚙️ Settings Modal */}
      {/* ========================================================= */}
      {isSettingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>🤖 إعدادات الأرشفة والجدولة الآلية</div>
              <button className={styles.closeBtn} onClick={() => setIsSettingsOpen(false)}>&times;</button>
            </div>

            {isSettingsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
            ) : (
              <form onSubmit={handleSaveSettings}>
                <div className={styles.toggleContainer}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>تفعيل الأرشفة التلقائية</span>
                    <span className={styles.toggleDesc}>عند التفعيل، سيقوم النظام بحفظ تقرير أداء CPO دورياً في الأرشيف.</span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={alertActive} 
                      onChange={(e) => setAlertActive(e.target.checked)} 
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>معدل التحديث والجدولة (بالدقائق):</label>
                  <input 
                    type="number" 
                    className={styles.input} 
                    value={alertInterval} 
                    onChange={(e) => setAlertInterval(Number(e.target.value))}
                    min="60"
                    max="1440"
                    required
                  />
                  <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    * الحد الأدنى المسموح به هو 60 دقيقة لتفادي حظر حسابك الإعلاني من ميتا.
                  </span>
                </div>

                <div className={styles.actions}>
                  <button 
                    type="button" 
                    className={styles.btnSave} 
                    style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.3)', marginLeft: 'auto' }}
                    onClick={seedDemoData}
                    disabled={isSeeding}
                  >
                    {isSeeding ? '⏳ جاري التوليد...' : '⚡ توليد بيانات تجريبية (14 يوماً)'}
                  </button>
                  <button type="button" className={styles.btnCancel} onClick={() => setIsSettingsOpen(false)} disabled={isSettingsSaving || isSeeding}>
                    إلغاء
                  </button>
                  <button type="submit" className={styles.btnSave} disabled={isSettingsSaving || isSeeding}>
                    {isSettingsSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function buildProfile(dayReports: any[]): HourSnap[] {
  const sorted = [...dayReports].sort((a, b) => {
    const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
    const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
    return tA - tB;
  });

  return Array.from({ length: 24 }, (_, hour) => {
    let bestReport: any = null;
    for (const r of sorted) {
      const rDate = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
      const rHour = rDate.getHours();
      if (rHour <= hour) {
        bestReport = r;
      } else {
        break;
      }
    }

    if (bestReport) {
      const rawProducts = bestReport.data || [];
      const groupedMap: Record<string, any> = {};
      
      rawProducts.forEach((row: any) => {
        const code = (row.trackingCode || '').trim().toLowerCase();
        const account = (row.accountName || '').trim();
        if (!code) return;
        
        const key = `${code}::${account}`;
        if (!groupedMap[key]) {
          groupedMap[key] = {
            productId: row.productId || row.trackingCode,
            productName: row.productName,
            accountName: row.accountName,
            trackingCode: row.trackingCode,
            matchedCampaigns: row.matchedCampaigns || 0,
            totalSpend: row.totalSpend || 0,
            validOrdersCount: row.validOrdersCount || 0,
            deliveredOrdersCount: row.deliveredOrdersCount || 0,
          };
        } else {
          const currentName = groupedMap[key].productName;
          if (row.productName && !currentName.includes(row.productName)) {
            groupedMap[key].productName = currentName + " + " + row.productName;
          }
          groupedMap[key].totalSpend = Math.max(groupedMap[key].totalSpend, row.totalSpend || 0);
          groupedMap[key].validOrdersCount += row.validOrdersCount || 0;
          groupedMap[key].deliveredOrdersCount += (row.deliveredOrdersCount || 0);
        }
      });
      
      const products = Object.values(groupedMap).map((row: any) => {
        row.cpa = row.validOrdersCount > 0 ? row.totalSpend / row.validOrdersCount : (row.totalSpend > 0 ? -1 : 0);
        row.netCpo = row.deliveredOrdersCount > 0 ? row.totalSpend / row.deliveredOrdersCount : (row.totalSpend > 0 ? -1 : 0);
        return row;
      });

      const totalSpend = products.reduce((sum: number, r: any) => sum + (r.totalSpend || 0), 0);
      const totalOrders = products.reduce((sum: number, r: any) => sum + (r.validOrdersCount || 0), 0);
      const cpa = totalOrders > 0 ? totalSpend / totalOrders : 0;
      return {
        hour,
        hasData: true,
        totalSpend,
        totalOrders,
        cpa,
        products,
        timestamp: bestReport.timestamp
      };
    } else {
      return {
        hour,
        hasData: false,
        totalSpend: 0,
        totalOrders: 0,
        cpa: 0,
        products: [],
        timestamp: null
      };
    }
  });
}
