import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';
import crypto from 'crypto';

// دالة مساعدة لتشفير البيانات بصيغة SHA256 كما تتطلب ميتا
const hashData = (data: string | undefined | null, isPhone: boolean = false) => {
  if (!data) return undefined;
  let trimmed = data.trim().toLowerCase();
  if (isPhone) {
    trimmed = trimmed.replace(/\D/g, ''); // Remove non-digits
    if (trimmed.startsWith('07') && trimmed.length === 11) {
      trimmed = '964' + trimmed.substring(1);
    } else if (trimmed.startsWith('7') && trimmed.length === 10) {
      trimmed = '964' + trimmed;
    }
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
};

// ترويسات CORS للسماح بالطلبات الخارجية
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const { 
      orderId, productId, productName, quantity, value, currency, email, phone, firstName, lastName, city, state, 
      client_ip, user_agent, event_source_url, externalId, fb_login_id, userId, pixelDocId 
    } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "Missing productId parameter" }, { status: 400, headers: corsHeaders });
    }

    // 1. Connection settings lookup scoped to user
    const connectionsRef = userId
      ? adminDb!.collection('users').doc(userId).collection('integrations').doc('meta').collection('connections')
      : adminDb!.collection('integrations').doc('meta').collection('connections');
      
    let querySnapshot: any = { empty: true, docs: [] };
    
    if (pixelDocId) {
      // Smart routing: Fetch exact pixel
      const docRef = connectionsRef.doc(pixelDocId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        querySnapshot = { empty: false, docs: [docSnap] };
      }
    } else {
      // Legacy fallback
      querySnapshot = await connectionsRef.where("linkedProducts", "array-contains", productId).get();
      
      // Fallback: If no pixel is linked to this specific product, use ALL pixels for this user
      if (querySnapshot.empty) {
        querySnapshot = await connectionsRef.get();
      }
    }

    if (querySnapshot.empty) {
      return NextResponse.json({ error: `No pixel found.` }, { status: 404, headers: corsHeaders });
    }

    // 2. تجهيز بيانات المستخدم وتشفيرها
    const userData: any = {
      client_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
      client_user_agent: request.headers.get('user-agent') || 'Unknown',
    };
    
    if (email) {
      const hashedEmail = hashData(email);
      if (hashedEmail) userData.em = [hashedEmail];
    }
    
    if (phone) {
      const hashedPhone = hashData(phone, true); // Pass true for isPhone
      if (hashedPhone) userData.ph = [hashedPhone];
    }

    if (firstName) {
      const hashedFn = hashData(firstName);
      if (hashedFn) userData.fn = [hashedFn];
    }

    if (state) {
      const hashedSt = hashData(state);
      if (hashedSt) userData.st = [hashedSt];
    }

    if (externalId) {
      const hashedExternalId = hashData(externalId);
      if (hashedExternalId) userData.external_id = [hashedExternalId];
    }

    if (fb_login_id) {
      userData.fb_login_id = fb_login_id;
    }

    const eventTime = Math.floor(Date.now() / 1000);

    // 3. Loop through all matching pixels and send events
    const promises = querySnapshot.docs.map(async (doc: any) => {
      const { pixelId, accessToken, testEventCode } = doc.data();

      if (!pixelId || !accessToken) return { status: 'rejected', reason: 'Missing credentials' };

      const metaPayload: any = {
        data: [
          {
            event_name: 'Purchase',
            event_time: eventTime,
            event_id: orderId ? `ord_${orderId}_${eventTime}` : undefined,
            action_source: 'website',
            user_data: userData,
            custom_data: {
              value: value ? Number(value) : 0,
              currency: currency || 'IQD',
              contents: [{
                id: productId,
                quantity: quantity ? Number(quantity) : 1,
                item_price: value ? Number(value) : 0
              }],
              content_type: 'product',
              content_name: productName || 'Unknown Product'
            }
          }
        ],
        access_token: accessToken
      };

      if (testEventCode && testEventCode.trim() !== '') {
        metaPayload.test_event_code = testEventCode.trim();
      }

      const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events`;
      
      const metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload)
      });

      const metaResponseData = await metaResponse.json();

      if (!metaResponse.ok) {
        console.error(`Meta CAPI Error for Pixel ${pixelId}:`, metaResponseData);
        throw new Error(JSON.stringify(metaResponseData));
      }

      return { pixelId, metaResponseData };
    });

    const results = await Promise.allSettled(promises);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length === results.length) {
      return NextResponse.json({ error: "All Meta API calls failed", details: failures }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, message: `Purchase event sent to ${results.length} pixels successfully.`, results }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

// معالجة طلبات Preflight لتمكين CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
