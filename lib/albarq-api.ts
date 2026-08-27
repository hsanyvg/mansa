import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

// Helper function to map governorates to Albarq codes
const mapGovernorateToAlbarq = (governorate: string): string => {
  const mapping: { [key: string]: string } = {
    'بغداد': 'BGD',
    'البصرة': 'BSR',
    'بصرة': 'BSR',
    'أربيل': 'ERB',
    'اربيل': 'ERB',
    'ديالى': 'DYL',
    'السليمانية': 'SUL',
    'سليمانية': 'SUL',
    'كركوك': 'KIR',
    'نينوى': 'NIN',
    'الموصل': 'NIN',
    'موصل': 'NIN',
    'دهوك': 'DHK',
    'الأنبار': 'ANB',
    'الانبار': 'ANB',
    'الرمادي': 'ANB',
    'بابل': 'BBL',
    'الحلة': 'BBL',
    'ذي قار': 'DHQ',
    'الناصرية': 'DHQ',
    'القادسية': 'QAD',
    'الديوانية': 'QAD',
    'كربلاء': 'KAR',
    'ميسان': 'MYS',
    'العمارة': 'MYS',
    'المثنى': 'MUT',
    'السماوة': 'MUT',
    'النجف': 'NJF',
    'نجف': 'NJF',
    'صلاح الدين': 'SAL',
    'تكريت': 'SAL',
    'واسط': 'WAS',
    'الكوت': 'WAS',
  };
  
  const normalized = (governorate || '').trim();
  
  return mapping[normalized] || 'BGD'; // Default to Baghdad if not found
};

export const createAlbarqShipment = async (userId: string, orderData: any) => {
  try {
    // 1. Read API Key and Store ID from Firestore
    const integrationRef = doc(db, 'users', userId, 'integrations', 'albarq');
    const docSnap = await getDoc(integrationRef);
    
    if (!docSnap.exists()) {
      throw new Error('MISSING_CREDENTIALS');
    }
    
    const { apiKey, storeId } = docSnap.data();
    
    if (!apiKey || !storeId) {
      throw new Error('MISSING_CREDENTIALS');
    }
    
    // 2. Map Governorate
    const governorateName = orderData.customerCity || orderData.governorate || '';
    const governorateCode = mapGovernorateToAlbarq(governorateName);
    
    const itemsText = orderData.items && orderData.items.length > 0
      ? orderData.items.map((it: any) => `${it.productName || it.name} (${it.quantity})`).join(' - ')
      : 'طلب من المتجر';

    const areaName = orderData.customerArea || orderData.area || orderData.region || '';
    const baseAddress = orderData.customerAddress || orderData.address || governorateName || 'العنوان غير محدد';
    const finalAddress = areaName ? `${areaName} - ${baseAddress}` : baseAddress;

    // 3. Prepare payload based on the provided JSON structure
    const payload = [
      {
        recipientPhone: orderData.customerPhone || orderData.phone1 || orderData.phone || '',
        receiptNumber: orderData.orderNumber || orderData.id,
        recipientName: orderData.customerName || 'عميل',
        governorate: governorateCode,
        storeID: Number(storeId),
        recipientAddress: finalAddress,
        details: itemsText,
        totalCost: Number(orderData.totalAmount || 0),
        deliveryType: "NORMAL",
        notes: orderData.notes || '',
        quantity: 1
      }
    ];

    // 4. Make API Request
    const endpoint = 'https://api.albarqiq.net/api/v1/orders/create'; 
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
    
    const textData = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(textData);
    } catch (e) {
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${textData.substring(0, 100)}`);
      }
      throw new Error('رد غير متوقع من الخادم.');
    }

    if (!response.ok) {
      throw new Error(responseData.message || responseData.error || 'فشل إرسال الطلب لشركة البرق');
    }
    
    if (responseData.status === 'error' || responseData.success === false) {
       throw new Error(responseData.message || 'تم الرفض من قبل نظام البرق');
    }

    return {
      success: true,
      receiptNumber: orderData.orderNumber || orderData.id,
      data: responseData
    };

  } catch (error: any) {
    if (error.message === 'MISSING_CREDENTIALS') {
      throw new Error('يرجى إدخال بيانات الربط (مفتاح API ومعرف المتجر) الخاصة بشركة البرق من الإعدادات.');
    }
    console.error('Albarq API Error:', error);
    throw new Error(error.message || 'فشل الاتصال بشركة البرق.');
  }
};
