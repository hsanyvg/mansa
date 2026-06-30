import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

// Force dynamic execution since it relies on external DB state
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // 1. Check if alerts are enabled (bypass if force is true)
    const settingsRef = doc(db, 'alerts_settings', 'cpo_alerts');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!force && (!settingsSnap.exists() || !settingsSnap.data().isActive)) {
      return NextResponse.json({ message: 'Alerts are disabled in settings.' }, { status: 200 });
    }

    // No telegram checks anymore

    // 2. Fetch Active Meta Accounts
    const metaAccsSnap = await getDocs(collection(db, 'meta_api_accounts'));
    const allAccs = metaAccsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const activeAccs = allAccs.filter(a => a.isActive !== false);

    if (activeAccs.length === 0) {
      return NextResponse.json({ error: 'No active Meta API accounts found.' }, { status: 400 });
    }

    // 3. Fetch Structural Names to exclude them
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    const categoriesDb = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    const pagesSnap = await getDocs(collection(db, 'pages_stores'));
    const pagesDb = pagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // 4. Fetch Products with Tracking Codes (Grouped by trackingCode)
    const productsSnap = await getDocs(collection(db, 'products'));
    const groupedTrackedMap = new Map<string, { trackingCode: string, productIds: string[], productNames: string[] }>();
    
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

    const compProductsSnap = await getDocs(collection(db, 'composite_products'));
    compProductsSnap.forEach(doc => {
      const data = doc.data();
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
    );

    if (trackedProducts.length === 0) {
      return NextResponse.json({ message: 'No tracked products found.' }, { status: 200 });
    }

    // 5. Fetch Orders for Today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const ordersSnap = await getDocs(collection(db, 'orders'));
    const validOrdersCountByProduct = new Map<string, Set<string>>();
    const deliveredOrdersCountByProduct = new Map<string, Set<string>>();
    
    ordersSnap.forEach(doc => {
      const order = { id: doc.id, ...doc.data() } as any;
      let orderDate = new Date(0);
      if (order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate();
      } else if (order.addDate) {
        orderDate = new Date(order.addDate);
      }

      // Check if order is from today
      if (orderDate >= today) {
        const status = order.status || 'pending';
        const isValid = !['cancelled', 'returned'].includes(status);
        const isDelivered = status === 'delivered' || status === 'partial';

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

    // 6. Fetch Meta Campaigns Spend for Today (via internal route or direct fetch)
    // Note: Since this is an API route, we cannot reliably fetch from our own /api/meta-campaigns if hosted serverlessly without absolute URLs.
    // Instead, we will directly call the Meta Graph API here for simplicity.
    const sinceStr = today.toISOString().split('T')[0];
    const untilStr = new Date().toISOString().split('T')[0];

    const allCampaignsByAccount = await Promise.all(activeAccs.map(async (account: any) => {
      try {
        const url = `https://graph.facebook.com/v19.0/act_${account.adAccountId}/campaigns?fields=name,insights.time_range({"since":"${sinceStr}","until":"${untilStr}"}){spend}&limit=500&access_token=${account.accessToken}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const campaigns = (data.data || []).map((c: any) => {
          let spend = 0;
          if (c.insights && c.insights.data && c.insights.data.length > 0) {
            spend = parseFloat(c.insights.data[0].spend || '0');
          }
          return { id: c.id, campaign_name: c.name, spend };
        });

        return { accountName: account.name, campaigns, error: null };
      } catch (err: any) {
        return { accountName: account.name, campaigns: [], error: err.message };
      }
    }));

    // 7. Match & Calculate
    const finalReport: any[] = [];
    let reportText = `📊 *تحديث تقارير التكلفة (CPO) اليومية*\n📅 التاريخ: ${new Date().toLocaleDateString('ar-IQ')}\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-IQ')}\n\n`;

    // Track already matched campaigns per account to prevent double counting spend
    const matchedCampaignsByAccount = new Map<string, Set<string>>();
    activeAccs.forEach((account: any) => {
      matchedCampaignsByAccount.set(account.name, new Set<string>());
    });

    trackedProducts.forEach(product => {
      const tCode = product.trackingCode.toLowerCase();
      
      const matchedOrderIds = new Set<string>();
      const matchedDeliveredOrderIds = new Set<string>();
      
      product.productIds.forEach(prodId => {
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
          const campaignKey = c.id || c.campaign_id;
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
          
          finalReport.push({
            productId: product.trackingCode,
            productName: product.productNames.join(" + "),
            accountName: accData.accountName,
            trackingCode: product.trackingCode,
            totalSpend,
            validOrdersCount: validOrders,
            deliveredOrdersCount: deliveredOrders,
            cpa
          });

          const formattedSpend = totalSpend.toFixed(2) + '$';
          const formattedCpa = cpa === -1 ? '∞' : cpa.toFixed(2) + '$';

          reportText += `📦 الصنف: *${product.productNames.join(" + ")}*\n`;
          reportText += `🔗 الحساب: ${accData.accountName}\n`;
          reportText += `💸 الصرف اليومي: ${formattedSpend}\n`;
          reportText += `📝 طلبات اليوم: ${validOrders}\n`;
          reportText += `🎯 تكلفة الطلب (CPA): *${formattedCpa}*\n`;
          reportText += `--------------------------\n`;
        }
      });
    });

    if (finalReport.length === 0) {
      reportText += `لا توجد بيانات مصروفات أو طلبات مسجلة لليوم.`;
    }

    // 8. Save to reports_archive
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dayStr = String(today.getDate()).padStart(2, '0');

    await addDoc(collection(db, 'reports_archive'), {
      month: yearMonth,
      day: `${yearMonth}-${dayStr}`,
      timestamp: serverTimestamp(),
      data: finalReport,
      summaryText: reportText
    });

    return NextResponse.json({ success: true, message: 'Report generated and archived successfully.', reportLength: finalReport.length }, { status: 200 });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
