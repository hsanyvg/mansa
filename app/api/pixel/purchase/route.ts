import { NextResponse } from 'next/server';
import { sendMetaEvent, MetaEvent } from '../../../../lib/meta-capi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, eventId, phone, city, totalAmount, contents, orderId, pixelId, accessToken } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    // استخراج IP و UserAgent من الـ Headers لدقة الاستهداف
    const clientIpAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const clientUserAgent = request.headers.get('user-agent') || '';

    const metaEvent: MetaEvent = {
      userId: userId, // آي دي المتجر (حتى نجيب البيكسل مالته من الداتا بيس إذا ما حددناه)
      pixelId: pixelId, // اختياري: إذا تريد تحدد البيكسل بشكل مباشر من الكود
      accessToken: accessToken, // اختياري: إذا تريد تحدد التوكن بشكل مباشر
      eventName: 'Purchase',
      eventId: eventId,
      userData: {
        phone: phone || '', // ندز بس الرقم بدون الاسم مثل ما اتفقنا
        city: city || 'بغداد',
        country: 'iq', // العراق بشكل افتراضي
        clientIpAddress,
        clientUserAgent
      },
      customData: {
        currency: 'IQD',
        value: totalAmount || 0,
        contents: contents || [],
        content_type: 'product',
        order_id: orderId
      }
    };

    // استدعاء دالة الإرسال لفيسبوك
    await sendMetaEvent(metaEvent);

    return NextResponse.json({ success: true, message: 'Purchase event triggered' });
  } catch (error) {
    console.error('Meta Purchase Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
