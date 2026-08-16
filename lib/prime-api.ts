import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export const PRIME_API_BASE = 'https://www.prime-iq.com/webapi';

let cachedToken: { token: string, expiresAt: number, userId: string } | null = null;

export async function getPrimeIntegration(userId: string) {
  const docRef = doc(db, 'users', userId, 'integrations', 'prime');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

export async function getPrimeToken(userId: string) {
  if (cachedToken && cachedToken.userId === userId && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const integration = await getPrimeIntegration(userId);

  if (!integration || !integration.login || !integration.password || !integration.initialToken) {
    throw new Error('يرجى إدخال بيانات الربط الخاصة ببرايم من الإعدادات');
  }

  const { login, password, initialToken } = integration;

  const response = await fetch(`${PRIME_API_BASE}/auth/external-system-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ login, password, initialToken }),
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    if (!response.ok) {
      throw new Error(`فشل تسجيل الدخول لشركة برايم: ${textData.substring(0, 100)}`);
    }
    throw new Error(`رد غير متوقع من خادم برايم: ${textData.substring(0, 50)}...`);
  }

  // Usually standard is { jwt: ... } or string
  const tokenValue = data.jwt || data.token || (typeof data === 'string' ? data : null);
  
  if (!response.ok || !tokenValue) {
    throw new Error(data.message || 'فشل تسجيل الدخول لشركة برايم. يرجى مراجعة الإعدادات.');
  }

  const finalToken = typeof tokenValue === 'string' ? tokenValue.replace('Bearer ', '').trim() : tokenValue;

  cachedToken = { 
    token: finalToken, 
    userId: userId,
    expiresAt: Date.now() + 1000 * 60 * 55 // 55 minutes cache
  };

  return finalToken;
}

export async function getPrimeStates(userId: string) {
  const token = await getPrimeToken(userId);
  const response = await fetch(`${PRIME_API_BASE}/general/states`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('فشل في جلب المحافظات من برايم');
  }
  return await response.json();
}

export async function getPrimeStateDistricts(userId: string, stateCode: string) {
  const token = await getPrimeToken(userId);
  const response = await fetch(`${PRIME_API_BASE}/general/state-districts/${stateCode}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('فشل في جلب الأقضية من برايم');
  }
  return await response.json();
}

export async function createPrimeShipment(order: any, userId: string) {
  const token = await getPrimeToken(userId);
  const integration = await getPrimeIntegration(userId);

  if (!integration || !integration.merchantLoginId) {
    throw new Error('يرجى التأكد من إدخال معرف التاجر (merchantLoginId) في إعدادات برايم');
  }

  // Prime governorate mapping fallback. Ideally mapped properly from user input.
  const primeStateCode = order.governorateCode || 'BGD'; 

  const payload = [
    {
      merchantLoginId: integration.merchantLoginId,
      custReceiptNoOri: order.orderNumber || order.id,
      receiverName: order.customerName,
      receiverHp1: order.customerPhone || order.phone1 || order.phone || '07700000000',
      state: primeStateCode,
      district: order.districtId || 1, // Fallback district
      receiptAmtIqd: Number(order.totalAmount || 0)
    }
  ];

  const response = await fetch(`${PRIME_API_BASE}/external/create-shipments`, {
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
    throw new Error(`رد غير متوقع عند إنشاء شحنة برايم: ${textData.substring(0, 50)}...`);
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || 'فشل إرسال الطلب لشركة التوصيل برايم');
  }

  return data;
}
