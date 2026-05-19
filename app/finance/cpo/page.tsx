"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

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
  matchedCampaigns: number;
  totalSpend: number;
  validOrdersCount: number;
  deliveredOrdersCount: number;
  cpa: number;
  netCpo: number;
}

export default function CPOReportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeAccounts, setActiveAccounts] = useState<any[]>([]);
  const [hasAccounts, setHasAccounts] = useState<boolean>(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  
  // Date range state
  const [sinceDate, setSinceDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [untilDate, setUntilDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Fetch Meta accounts on load
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const querySnap = await getDocs(collection(db, 'meta_api_accounts'));
        if (!querySnap.empty) {
          setHasAccounts(true);
          const allAccs = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const active = allAccs.filter((a: any) => a.isActive !== false);
          setActiveAccounts(active);
        } else {
          setHasAccounts(false);
          setActiveAccounts([]);
        }
      } catch (err) {
        console.error("Error fetching meta accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const generateReport = async () => {
    setIsLoading(true);
    setFetchErrors([]);
    try {
      // 1. Fetch active Meta accounts directly from DB for fresh status
      const querySnap = await getDocs(collection(db, 'meta_api_accounts'));
      const allAccs = querySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const active = allAccs.filter(a => a.isActive !== false);

      if (allAccs.length === 0) {
        alert("⚠️ الرجاء إعداد وتفعيل بوابة الربط (Meta Ads API) أولاً وإضافة حساب إعلاني واحد على الأقل.");
        setIsLoading(false);
        return;
      }

      if (active.length === 0) {
        alert("⚠️ جميع حسابات الربط معطلة حالياً. يرجى تفعيل حساب واحد على الأقل من بوابة الربط.");
        setIsLoading(false);
        return;
      }

      // Update state for warnings consistency
      setHasAccounts(true);
      setActiveAccounts(active);

      // 0. Fetch Categories and Pages to filter out structural items acting as products
      const categoriesSnap = await getDocs(collection(db, 'categories'));
      const categoriesDb = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const pagesSnap = await getDocs(collection(db, 'pages_stores'));
      const pagesDb = pagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 1. Fetch Products with Tracking Codes
      const productsSnap = await getDocs(collection(db, 'products'));
      const trackedProducts: ProductData[] = [];
      const allProductsMap = new Map<string, any>();
      
      productsSnap.forEach(doc => {
        const data = doc.data();
        
        // Filter out structural names
        const pNameClean = data.name?.trim().toLowerCase();
        if (pNameClean) {
          const isPageName = pagesDb.some(page => page.name?.trim().toLowerCase() === pNameClean);
          const isMainCatName = categoriesDb.some(cat => cat.name?.trim().toLowerCase() === pNameClean);
          const isSubCatName = categoriesDb.some(cat => 
            cat.subcategories?.some((sub: any) => sub.name?.trim().toLowerCase() === pNameClean)
          );
          if (isPageName || isMainCatName || isSubCatName) return; // Skip this product
        }

        allProductsMap.set(doc.id, { id: doc.id, ...data });
        if (data.trackingCode && data.trackingCode.trim() !== '') {
          trackedProducts.push({
            id: doc.id,
            name: data.name,
            trackingCode: data.trackingCode.trim()
          });
        }
      });

      // Fetch composite products too (if they have tracking codes)
      const compProductsSnap = await getDocs(collection(db, 'composite_products'));
      compProductsSnap.forEach(doc => {
        const data = doc.data();
        allProductsMap.set(doc.id, { id: doc.id, isComposite: true, ...data });
        if (data.trackingCode && data.trackingCode.trim() !== '') {
          trackedProducts.push({
            id: doc.id,
            name: data.name,
            trackingCode: data.trackingCode.trim()
          });
        }
      });

      if (trackedProducts.length === 0) {
        alert("لم يتم العثور على أي منتجات تحتوي على كود تتبع (CPO). الرجاء إضافتها من صفحة المنتجات.");
        setIsLoading(false);
        return;
      }

      // 2. Fetch Orders in date range
      // Firebase stores dates usually as strings in this system based on past files (`addDate` YYYY-MM-DD or timestamps)
      // We will fetch all and filter client side for safety since we don't know the exact index.
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const validOrdersCountByProduct = new Map<string, Set<string>>(); // productId -> Set of Order IDs
      const deliveredOrdersCountByProduct = new Map<string, Set<string>>(); // productId -> Set of Order IDs
      
      const sDateObj = new Date(sinceDate);
      const uDateObj = new Date(untilDate);
      uDateObj.setHours(23, 59, 59, 999); // End of day

      ordersSnap.forEach(doc => {
        const order = { id: doc.id, ...doc.data() } as any;
        
        // Filter by date (handling both timestamp and string 'addDate' if present)
        let orderDate = new Date();
        if (order.createdAt?.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.addDate) {
          orderDate = new Date(order.addDate);
        }

        if (orderDate >= sDateObj && orderDate <= uDateObj) {
           const status = order.status || 'pending';
           const isCancelledOrReturned = ['cancelled', 'returned'].includes(status);
           const isDelivered = status === 'delivered';
           const isValid = !isCancelledOrReturned; // pending, processing, shipped, delivered, backordered

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

      // 3. Fetch Meta Campaigns Spend in parallel for all active accounts
      const allCampaignsByAccount = await Promise.all(active.map(async (account: any) => {
        try {
          const res = await fetch('/api/meta-campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: account.accessToken,
              adAccountId: account.adAccountId,
              since: sinceDate,
              until: untilDate
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

      // Gather errors and update state
      const errorsList: string[] = [];
      allCampaignsByAccount.forEach(acc => {
        if (acc.error) {
          errorsList.push(`${acc.accountName}: ${acc.error}`);
        }
      });
      setFetchErrors(errorsList);

      // 4. Match & Calculate per Product per active Ad Account
      const finalReport: ReportRow[] = [];

      trackedProducts.forEach(product => {
        const tCode = product.trackingCode.toLowerCase();
        const validOrders = validOrdersCountByProduct.get(product.id)?.size || 0;
        const deliveredOrders = deliveredOrdersCountByProduct.get(product.id)?.size || 0;

        allCampaignsByAccount.forEach(accData => {
          // Find matching campaigns in this account
          const matched = accData.campaigns.filter((c: any) => {
            const cName = c.campaign_name.toLowerCase();
            return cName.includes(tCode) || cName.includes(`[${tCode}]`);
          });

          const totalSpend = matched.reduce((sum: number, c: any) => sum + c.spend, 0);
          
          // Only show products that have matching campaigns or spend on this account
          if (matched.length > 0 || totalSpend > 0) {
            const cpa = validOrders > 0 ? (totalSpend / validOrders) : (totalSpend > 0 ? -1 : 0);
            const netCpo = deliveredOrders > 0 ? (totalSpend / deliveredOrders) : (totalSpend > 0 ? -1 : 0);

            finalReport.push({
              productId: product.id,
              productName: product.name,
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

      // Sort by spend descending
      finalReport.sort((a, b) => b.totalSpend - a.totalSpend);
      setReportData(finalReport);

    } catch (err: any) {
      console.error("Error generating report:", err);
      alert("حدث خطأ أثناء جلب البيانات: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val === -1) return '∞ (لا يوجد طلبات)';
    if (val === 0) return '0.00$';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          📊 تقارير الأداء وتكلفة الطلب (CPO/CPA)
        </div>
        <div className={styles.headerActions}>
          <input 
            type="date" 
            value={sinceDate} 
            onChange={(e) => setSinceDate(e.target.value)} 
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: '#fff' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>إلى</span>
          <input 
            type="date" 
            value={untilDate} 
            onChange={(e) => setUntilDate(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: '#fff' }}
          />
          <button 
            className={styles.fetchButton} 
            onClick={generateReport}
            disabled={isLoading}
          >
            {isLoading ? 'جاري التحليل والمطابقة...' : '🔄 استخراج التقرير'}
          </button>
        </div>
      </header>

      {fetchErrors.length > 0 && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', direction: 'rtl' }}>
          <strong>⚠️ تنبيه: فشل جلب البيانات لبعض الحسابات الإعلانية:</strong>
          <ul style={{ marginTop: '0.5rem', marginRight: '1.5rem', listStyleType: 'disc', fontSize: '0.9rem' }}>
            {fetchErrors.map((err, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{err}</li>
            ))}
          </ul>
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            💡 قد يكون الـ <strong>Access Token</strong> قد انتهت صلاحيته أو غير صحيح. يرجى تجديد الـ Token واختبار الاتصال في <Link href="/settings/api-integrations" style={{ color: '#fff', textDecoration: 'underline' }}>بوابة الربط (API)</Link>.
          </div>
        </div>
      )}

      {!hasAccounts && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          ⚠️ <strong>تنبيه:</strong> لم يتم العثور على أي حسابات ربط مضافة. يرجى <Link href="/settings/api-integrations" style={{ color: '#fff', textDecoration: 'underline' }}>إعداد وتفعيل بوابة الربط (API) هنا</Link> لتتمكن من جلب بيانات الحملات.
        </div>
      )}

      {hasAccounts && activeAccounts.length === 0 && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#f59e0b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          ⚠️ <strong>تنبيه:</strong> جميع حسابات ربط إعلانات ميتا (Meta Ads API) معطلة حالياً. يمكنك تفعيلها وتعديلها في أي وقت من <Link href="/settings/api-integrations" style={{ color: '#fff', textDecoration: 'underline' }}>بوابة الربط (API)</Link>.
        </div>
      )}

      {reportData.length > 0 ? (
        <div className={styles.contentWrapper}>
          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <span className={styles.infoCardTitle}>إجمالي إنفاق الحملات المطابقة</span>
              <span className={styles.infoCardValue}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  reportData.reduce((sum, row) => sum + row.totalSpend, 0)
                )}
              </span>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoCardTitle}>إجمالي الطلبات الصالحة</span>
              <span className={`${styles.infoCardValue} ${styles.accent}`}>
                {reportData.reduce((sum, row) => sum + row.validOrdersCount, 0)} طلب
              </span>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoCardTitle}>متوسط تكلفة الاستحواذ (CPA)</span>
              <span className={styles.infoCardValue} style={{ color: '#3b82f6' }}>
                {(() => {
                  const tSpend = reportData.reduce((sum, row) => sum + row.totalSpend, 0);
                  const tOrders = reportData.reduce((sum, row) => sum + row.validOrdersCount, 0);
                  return tOrders > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tSpend / tOrders) : '0.00$';
                })()}
              </span>
            </div>
          </div>

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
                {reportData.map((row, idx) => (
                  <tr key={`${row.productId}-${row.accountName}-${idx}`}>
                    <td style={{ fontWeight: 'bold' }}>{row.productName}</td>
                    <td style={{ color: 'var(--text-muted, #a0aec0)' }}>{row.accountName}</td>
                    <td><span className={styles.trackingBadge}>{row.trackingCode}</span></td>
                    <td>{row.matchedCampaigns}</td>
                    <td style={{ color: '#f87171', fontWeight: 'bold' }}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.totalSpend)}
                    </td>
                    <td>{row.validOrdersCount}</td>
                    <td className={styles.metricSecondary}>
                      {formatCurrency(row.cpa)}
                    </td>
                    <td>{row.deliveredOrdersCount}</td>
                    <td className={styles.metricPrimary}>
                      {formatCurrency(row.netCpo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📈</div>
          <h3>لا توجد بيانات للعرض</h3>
          <p>قم باختيار التاريخ واضغط على "استخراج التقرير" ليقوم النظام بمطابقة أكواد التتبع مع حملات ميتا الإعلانية تلقائياً.</p>
        </div>
      )}
    </div>
  );
}
