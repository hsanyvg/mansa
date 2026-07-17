// lib/meta-capi.ts
import crypto from 'crypto';
import { adminDb } from './firebaseAdmin';

/**
 * دالة مساعدة لتشفير البيانات بـ SHA-256 (مطلوب من فيسبوك)
 */
const hashData = (data: string | undefined | null): string | undefined => {
  if (!data) return undefined;
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
};

export interface MetaEvent {
  userId?: string;          // آي دي المتجر/الزبون بالفايربيس
  connectionName?: string;  // اختياري: اسم الربط (مثلا إذا المتجر عنده أكثر من بيكسل)
  pixelId?: string;         // اختياري: إذا أردت تمريره مباشرة
  accessToken?: string;     // اختياري: إذا أردت تمريره مباشرة
  eventName: 'Purchase' | 'LeadSubmitted' | string;
  eventTime?: number;
  eventId: string;          // مهم لمنع التكرار
  userData: {
    phone?: string;
    city?: string;
    country?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
  };
  customData?: {
    currency?: string;
    value?: number;
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
    content_type?: string;
    order_id?: string;
  };
}

/**
 * دالة لإرسال الأحداث إلى فيسبوك Conversions API
 */
export const sendMetaEvent = async (event: MetaEvent) => {
  let PIXEL_ID = event.pixelId || process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  let ACCESS_TOKEN = event.accessToken || process.env.META_ACCESS_TOKEN || process.env.NEXT_PUBLIC_META_ACCESS_TOKEN;

  // جلب البيانات من قاعدة البيانات إذا تم تمرير userId
  if (event.userId && adminDb && (!event.pixelId || !event.accessToken)) {
    try {
      const connectionsRef = adminDb.collection('users').doc(event.userId).collection('integrations').doc('meta').collection('connections');
      let querySnapshot;
      
      if (event.connectionName) {
        querySnapshot = await connectionsRef.where('name', '==', event.connectionName).get();
      } else {
        querySnapshot = await connectionsRef.limit(1).get(); // سحب أول ربط متوفر إذا لم يحدد الاسم
      }

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        if (docData.pixelId) PIXEL_ID = docData.pixelId;
        if (docData.accessToken) ACCESS_TOKEN = docData.accessToken;
      }
    } catch (error) {
      console.error('Meta CAPI: Error fetching credentials from Firestore', error);
    }
  }

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error(`Meta CAPI: Missing Pixel ID or Access Token. Event '${event.eventName}' not sent.`);
    return;
  }

  // تجهيز بيانات العميل المشفرة
  const user_data: any = {
    client_ip_address: event.userData.clientIpAddress,
    client_user_agent: event.userData.clientUserAgent,
  };

  if (event.userData.phone) user_data.ph = [hashData(event.userData.phone)];
  if (event.userData.city) user_data.ct = [hashData(event.userData.city)];
  if (event.userData.country) user_data.country = [hashData(event.userData.country)];

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: event.eventId,
        user_data,
        custom_data: event.customData,
      },
    ],
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (response.ok) {
      console.log(`Meta CAPI: Event '${event.eventName}' sent successfully to Pixel ${PIXEL_ID}.`);
    } else {
      console.error(`Meta CAPI Error sending '${event.eventName}':`, result);
    }
  } catch (error) {
    console.error('Meta CAPI Request Failed:', error);
  }
};
