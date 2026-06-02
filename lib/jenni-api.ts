import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export const JENNI_API_BASE = 'https://almasara.jenni.delivery/api';

export const GOVERNORATE_CODES: Record<string, string> = {
  'بغداد': 'BGD',
  'البصرة': 'BAS',
  'نينوى': 'NIN',
  'نينوى (الموصل)': 'NIN',
  'أربيل': 'ARB',
  'اربيل': 'ARB',
  'النجف': 'NJF',
  'كركوك': 'KRK',
  'الأنبار': 'ANB',
  'الانبار': 'ANB',
  'الأنبار (الرمادي)': 'ANB',
  'بابل': 'BBL',
  'بابل (الحلة)': 'BBL',
  'ذي قار': 'DHI',
  'ذي قار (الناصرية)': 'DHI',
  'دهوك': 'DOH',
  'ديالى': 'DYL',
  'ديالى (بعقوبة)': 'DYL',
  'كربلاء': 'KRB',
  'المثنى': 'MTH',
  'المثنى (السماوة)': 'MTH',
  'ميسان': 'MYS',
  'ميسان (العمارة)': 'MYS',
  'القادسية': 'QAD',
  'القادسية (الديوانية)': 'QAD',
  'صلاح الدين': 'SAH',
  'صلاح الدين (تكريت)': 'SAH',
  'السليمانية': 'SMH',
  'واسط': 'WST',
  'واسط (الكوت)': 'WST'
};

export function getGovernorateCode(name: string): string {
  if (!name) return 'BGD'; // افتراضي
  return GOVERNORATE_CODES[name] || 'BGD'; 
}

export async function getDeliveryIntegration(userId: string) {
  const docRef = doc(db, 'users', userId, 'integrations', 'delivery');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

export async function getJenniToken(userId: string) {
  const integration = await getDeliveryIntegration(userId);

  if (!integration || !integration.username || !integration.password) {
    throw new Error('يرجى ربط حساب شركة التوصيل من الإعدادات أولاً');
  }

  // ملاحظة أمنية: في بيئة الإنتاج الفعلية، قد تحتاج لفك تشفير كلمة المرور هنا إذا قمت بتشفيرها قبل الحفظ.
  const username = integration.username;
  const password = integration.password;

  const response = await fetch(`${JENNI_API_BASE}/v2/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    // If it's not JSON, maybe it's a plain text error from the server (like "Login failed: Bad credentials")
    if (!response.ok) {
      throw new Error(`فشل تسجيل الدخول: ${textData.substring(0, 100)}`);
    }
    throw new Error(`رد غير متوقع من الخادم: ${textData.substring(0, 50)}...`);
  }

  if (!response.ok || !data.token) {
    throw new Error(data.message || 'فشل تسجيل الدخول لشركة التوصيل. يرجى مراجعة الإعدادات (اسم المستخدم وكلمة المرور).');
  }

  return { token: data.token.replace('Bearer ', '').trim(), systemCode: integration.systemCode };
}

export async function createJenniShipment(order: any, userId: string) {
  const { token, systemCode } = await getJenniToken(userId);

  if (!systemCode) {
    throw new Error('رمز النظام (System Code) غير متوفر، يرجى تحديث الإعدادات.');
  }

  const payload = {
    system_code: systemCode,
    shipments: [
      {
        shipment_number: order.orderNumber || order.id,
        external_shipment_id: order.id, 
        receiver_name: order.customerName,
        receiver_phone_1: order.customerPhone || order.phone1 || order.phone || '07700000000',
        governorate_code: getGovernorateCode(order.governorate),
        city: order.district || order.city || 'المركز',
        address: order.address || 'غير محدد',
        amount_iqd: Number(order.totalAmount || 0),
      }
    ]
  };

  const response = await fetch(`${JENNI_API_BASE}/v2/shipments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    if (!response.ok) {
      throw new Error(`فشل الإرسال: ${textData.substring(0, 100)}`);
    }
    throw new Error(`رد غير متوقع عند إنشاء الشحنة: ${textData.substring(0, 50)}...`);
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || 'فشل إرسال الطلب لشركة التوصيل');
  }

  if (data.success === false) {
    const reason = data.rejected_shipments?.[0]?.reason || data.message || 'تم رفض الشحنة من قبل النظام';
    throw new Error(`تم الرفض: ${reason}`);
  }

  // إعادة رقم التتبع والشحنة
  return data;
}

export async function queryJenniShipment(shipmentNumbers: string[], userId: string) {
  const { token } = await getJenniToken(userId);

  const response = await fetch(`${JENNI_API_BASE}/v2/shipments/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ shipment_numbers: shipmentNumbers })
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    if (!response.ok) {
      throw new Error(`فشل الاستعلام: ${textData.substring(0, 100)}`);
    }
    throw new Error(`رد غير متوقع عند الاستعلام: ${textData.substring(0, 50)}...`);
  }

  if (!response.ok) {
    throw new Error(data.message || 'فشل الاستعلام عن الشحنة');
  }
  return data;
}
