import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import crypto from 'crypto';

// دالة مساعدة لتشفير البيانات بصيغة SHA256 كما تتطلب ميتا
const hashData = (data: string | undefined | null) => {
  if (!data) return undefined;
  // ميتا تتطلب إزالة الفراغات وتحويل النص إلى أحرف صغيرة قبل التشفير
  const trimmedData = data.trim().toLowerCase();
  return crypto.createHash('sha256').update(trimmedData).digest('hex');
};

// ترويسات CORS للسماح بالطلبات الخارجية
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, value, currency, email, phone, firstName, state, externalId, fb_login_id } = body;

    if (!productId) {
      return NextResponse.json({ error: "Missing productId parameter" }, { status: 400, headers: corsHeaders });
    }

    // 1. الاتصال بفايربيس والبحث عن إعدادات الربط
    const connectionsRef = collection(db, 'integrations', 'meta', 'connections');
    const q = query(connectionsRef, where("linkedProducts", "array-contains", productId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: `No pixel found linked to product '${productId}'.` }, { status: 404, headers: corsHeaders });
    }

    const docData = querySnapshot.docs[0].data();
    const { pixelId, accessToken, testEventCode } = docData;

    if (!pixelId || !accessToken) {
      return NextResponse.json({ error: "Missing pixelId or accessToken in database." }, { status: 400, headers: corsHeaders });
    }

    // 2. تجهيز بيانات المستخدم وتشفيرها
    const userData: any = {};
    
    if (email) {
      const hashedEmail = hashData(email);
      if (hashedEmail) userData.em = [hashedEmail];
    }
    
    if (phone) {
      const hashedPhone = hashData(phone);
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
      // fb_login_id is sent unhashed
      userData.fb_login_id = fb_login_id;
    }

    // 3. بناء هيكل الطلب (Payload) الموجه إلى Meta API
    const metaPayload: any = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000), // الوقت الحالي بصيغة Unix Timestamp (بالثواني)
          action_source: 'website',
          user_data: userData,
          custom_data: {
            value: value ? Number(value) : 0,
            currency: currency || 'USD',
          }
        }
      ],
      // إرسال التوكن لتوثيق الطلب
      access_token: accessToken
    };

    // إضافة كود الاختبار إذا كان موجوداً لتجربة وصول الأحداث
    if (testEventCode && testEventCode.trim() !== '') {
      metaPayload.test_event_code = testEventCode.trim();
    }

    // 4. إرسال الطلب (Server-to-Server) إلى خوادم ميتا
    const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events`;
    
    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaPayload)
    });

    const metaResponseData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta CAPI Error:", metaResponseData);
      return NextResponse.json({ error: "Meta API returned an error", details: metaResponseData }, { status: metaResponse.status, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, message: "Purchase event sent successfully via CAPI", metaResponse: metaResponseData }, { status: 200, headers: corsHeaders });

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
