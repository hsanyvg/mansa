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
  interface PixelConfig {
    pixelId: string;
    accessToken: string;
    testEventCode?: string;
    linkedProducts?: string[];
  }

  const configs: PixelConfig[] = [];

  // جلب البيانات من قاعدة البيانات إذا تم تمرير userId
  if (event.userId && adminDb && (!event.pixelId || !event.accessToken)) {
    try {
      const connectionsRef = adminDb.collection('users').doc(event.userId).collection('integrations').doc('meta').collection('connections');
      const querySnapshot = event.connectionName 
        ? await connectionsRef.where('name', '==', event.connectionName).get()
        : await connectionsRef.get(); // Fetch all connections

      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.pixelId && data.accessToken) {
          configs.push({
            pixelId: data.pixelId,
            accessToken: data.accessToken,
            testEventCode: data.testEventCode,
            linkedProducts: data.linkedProducts || []
          });
        }
      });
    } catch (error) {
      console.error('Meta CAPI: Error fetching credentials from Firestore', error);
    }
  } else if (event.pixelId && event.accessToken) {
    // If passed directly
    configs.push({
      pixelId: event.pixelId,
      accessToken: event.accessToken
    });
  }

  if (configs.length === 0) {
    console.log(`Meta CAPI: No Pixel configurations found for event '${event.eventName}'.`);
    return;
  }

  // تجهيز بيانات العميل المشفرة المشتركة
  const user_data: any = {
    client_ip_address: event.userData.clientIpAddress,
    client_user_agent: event.userData.clientUserAgent,
  };

  if (event.userData.phone) user_data.ph = [hashData(event.userData.phone)];
  if (event.userData.city) user_data.ct = [hashData(event.userData.city)];
  if (event.userData.country) user_data.country = [hashData(event.userData.country)];

  const originalContents = event.customData?.contents || [];

  // Loop through each configured pixel and send the event if applicable
  for (const config of configs) {
    let filteredContents = originalContents;
    let filteredValue = event.customData?.value || 0;

    // Filter contents if this pixel has specific linked products
    if (config.linkedProducts && config.linkedProducts.length > 0 && originalContents.length > 0) {
      filteredContents = originalContents.filter(item => config.linkedProducts!.includes(item.id));
      
      // If none of the order items match the pixel's linked products, skip this pixel completely
      if (filteredContents.length === 0) {
        console.log(`Meta CAPI: Skipping Pixel ${config.pixelId} because no order items matched its linked products.`);
        continue;
      }

      // Recalculate the value based ONLY on the matching products
      filteredValue = filteredContents.reduce((sum, item) => sum + (item.quantity * (item.item_price || 0)), 0);
    }

    const payload: any = {
      data: [
        {
          event_name: event.eventName,
          event_time: event.eventTime || Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_id: `${event.eventId}_${config.pixelId}`, // Ensure unique event_id per pixel
          user_data,
          custom_data: {
            ...event.customData,
            value: filteredValue,
            contents: filteredContents
          },
        },
      ],
    };

    if (config.testEventCode) {
      payload.test_event_code = config.testEventCode;
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${config.pixelId}/events?access_token=${config.accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok) {
        console.log(`Meta CAPI: Event '${event.eventName}' sent successfully to Pixel ${config.pixelId} with value ${filteredValue}.`);
      } else {
        console.error(`Meta CAPI Error sending '${event.eventName}' to Pixel ${config.pixelId}:`, result);
      }
    } catch (error) {
      console.error(`Meta CAPI Request Failed for Pixel ${config.pixelId}:`, error);
    }
  }
};
