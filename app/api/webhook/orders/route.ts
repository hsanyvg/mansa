import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, X-Requested-With, Accept',
};

export async function OPTIONS() {
  return NextResponse.json({ status: 'ok' }, { status: 200, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Webhook is running. Please send a POST request with order data.',
  }, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        } else {
          const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        }
        initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (e: any) {
        console.error('Firebase app init error:', e);
      }
    }

    const adminDb = getApps().length ? getFirestore() : null;

    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const incomingApiKey = request.headers.get('x-api-key') || bearerToken;
    const userId = process.env.USER_ID || 'guAXkcygceeBkpwtFdf1n8O3dRX2';

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Internal Server Error: Database not initialized. Ensure FIREBASE_SERVICE_ACCOUNT_KEY env var is set.' },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!incomingApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing API Key' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Fetch integration config from Firestore (Multiple Webhooks)
    const integrationDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('integrations')
      .doc('webhooks')
      .get();

    let matchedLandingPage = null;

    if (integrationDoc.exists) {
      const data = integrationDoc.data();
      const landingPages = data?.landingPages || [];
      matchedLandingPage = landingPages.find((lp: any) => lp.apiKey === incomingApiKey);
    }

    // Fallback logic for the old 'webhook' document or env if not found in new array
    if (!matchedLandingPage) {
      const oldIntegrationDoc = await adminDb
        .collection('users')
        .doc(userId)
        .collection('integrations')
        .doc('webhook')
        .get();
        
      let validApiKey = process.env.API_KEY;
      let isWebhookActive = true;

      if (oldIntegrationDoc.exists) {
        const data = oldIntegrationDoc.data();
        if (data?.apiKey) validApiKey = data.apiKey;
        if (data?.isActive === false) isWebhookActive = false;
      }

      if (incomingApiKey === validApiKey) {
        matchedLandingPage = {
          name: 'Landing Page Webhook (Legacy)',
          isActive: isWebhookActive
        };
      }
    }

    if (!matchedLandingPage) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API Key' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!matchedLandingPage.isActive) {
      return NextResponse.json(
        { error: 'Forbidden: This landing page webhook is currently disabled' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { customerName, phoneNumber, governorate, productName, quantity, totalPrice, notes, source } = body;

    // 3. Basic validation of required fields
    if (!customerName || !phoneNumber || !governorate || !productName || !quantity || !totalPrice) {
      return NextResponse.json(
        { error: 'Bad Request: Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3.5. Lookup actual Product and deduct stock
    let productDoc: any = null;
    
    // First try by linkedProductId
    if (matchedLandingPage?.linkedProductId) {
      const pDoc = await adminDb
        .collection('users')
        .doc(userId)
        .collection('products')
        .doc(matchedLandingPage.linkedProductId)
        .get();
      if (pDoc.exists) {
        productDoc = pDoc;
      }
    }
    
    // Fallback to name search if not found or no linkedProductId
    if (!productDoc) {
      const productsSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('products')
        .where('name', '==', productName)
        .limit(1)
        .get();
        
      if (!productsSnapshot.empty) {
        productDoc = productsSnapshot.docs[0];
      }
    }
      
    let actualProductId = 'lp_product';
    let isComposite = false;
    let composition = null;
    let dbProductRef = null;
    let currentStock = null;
    let productUnits = [];

    if (productDoc) {
      actualProductId = productDoc.id;
      const productData = productDoc.data();
      isComposite = productData.isComposite || false;
      composition = productData.composition || null;
      dbProductRef = productDoc.ref;
      currentStock = productData.stock || {};
      productUnits = productData.units || [];
    }

    // Deduct inventory if product found
    if (dbProductRef) {
      if (!isComposite) {
        const firstStoreKey = Object.keys(currentStock)[0] || 'default_store';
        if (!currentStock[firstStoreKey]) {
           currentStock[firstStoreKey] = { quantity: 0, unit: productUnits[0]?.type || 'قطعة' };
        }
        currentStock[firstStoreKey].quantity -= Number(quantity);
        
        let newTotalBaseQuantity = 0;
        Object.values(currentStock).forEach((s: any) => {
          const uMul = productUnits.find((u: any) => u.type === s.unit)?.count || 1;
          newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
        });

        await dbProductRef.update({
          stock: currentStock,
          totalBaseQuantity: newTotalBaseQuantity
        });
      } else if (isComposite && composition) {
        // Deduct from components
        for (const comp of composition) {
          const rawProdRef = adminDb.collection('users').doc(userId).collection('products').doc(comp.itemId);
          const rawSnap = await rawProdRef.get();
          if (rawSnap.exists) {
            const rawData = rawSnap.data();
            if (!rawData) continue;
            let stock = { ...rawData.stock };
            let qtyToDeduct = comp.quantityNeeded * Number(quantity);
            
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
              stock[firstStoreKey] = { quantity: 0, unit: rawData.units?.[0]?.type || 'قطعة' };
            }
            stock[firstStoreKey].quantity -= qtyToDeduct;
            
            let newTotalBaseQuantity = 0;
            Object.values(stock).forEach((s: any) => {
              const uMul = (rawData.units || []).find((u: any) => u.type === s.unit)?.count || 1;
              newTotalBaseQuantity += (Number(s.quantity) || 0) * uMul;
            });

            await rawProdRef.update({
              stock: stock,
              totalBaseQuantity: newTotalBaseQuantity
            });
          }
        }
      }
    }

    // 4. Prepare Order Object
    // Get the next sequential ID using a transaction
    const counterRef = adminDb.collection('users').doc(userId).collection('metadata').doc('orderCounter');
    const nextId = await adminDb.runTransaction(async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentId = 100000;
      if (counterSnap.exists) {
        currentId = counterSnap.data()?.lastId || 100000;
      }
      const newId = currentId + 1;
      transaction.set(counterRef, { lastId: newId }, { merge: true });
      return newId;
    });

    const newOrder = {
      id: nextId.toString(),
      employeeId: 'landing_page_webhook',
      employeeName: matchedLandingPage.name || 'Landing Page',
      bookingEmployeeId: 'landing_page_webhook',
      bookingEmployeeName: 'Landing Page',
      customerName: customerName,
      customerPhone: phoneNumber,
      customerPhone2: '',
      governorate: governorate,
      region: '',
      notes: notes || 'طلب قادم من صفحة الهبوط أوتوماتيكياً',
      paymentMethod: 'كاش عند التوصيل',
      totalAmount: Number(totalPrice),
      items: [{
        productId: actualProductId,
        productName: productName,
        quantity: Number(quantity),
        unitPrice: Number(quantity) > 0 ? Number(totalPrice) / Number(quantity) : Number(totalPrice),
        total: Number(totalPrice),
        isComposite: isComposite,
        composition: composition
      }],
      date: FieldValue.serverTimestamp(),
      status: 'pending', // VERY IMPORTANT: Use 'pending' so it shows in the dashboard
      is_settled: false,
      source: source || matchedLandingPage.name || 'Landing Page Webhook',
      timestamp: new Date().getTime(),
    };

    // 5. Save to Firebase Firestore under the specific user's orders
    const docRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .doc(nextId.toString());
    await docRef.set(newOrder);

    // Trigger Meta and TikTok Pixels asynchronously
    try {
      const baseUrl = new URL(request.url).origin;
      const pixelPayload = {
        orderId: nextId.toString(),
        productId: actualProductId,
        productName: productName,
        quantity: Number(quantity) || 1,
        value: Number(totalPrice),
        currency: 'IQD',
        email: '',
        phone: phoneNumber,
        firstName: customerName,
        state: governorate,
        userId: userId,
        client_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
        user_agent: request.headers.get('user-agent') || 'Unknown',
        event_source_url: request.url
      };

      // Fire Meta and TikTok Pixels
      await Promise.allSettled([
        fetch(`${baseUrl}/api/webhooks/meta-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pixelPayload)
        }).then(async res => {
           if(!res.ok) console.error('Meta Pixel Trigger Error:', await res.text());
        }),
        fetch(`${baseUrl}/api/webhooks/tiktok-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pixelPayload)
        }).then(async res => {
           if(!res.ok) console.error('TikTok Pixel Trigger Error:', await res.text());
        })
      ]);
    } catch (pixelErr) {
      console.error('Error triggering pixels:', pixelErr);
    }

    // 6. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        orderId: nextId.toString(),
        order_id: nextId.toString(),
        id: nextId.toString(),
        firebaseId: nextId.toString(),
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
