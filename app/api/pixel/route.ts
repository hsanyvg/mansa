import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase'; // مسار ملف الفايربيس
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: Request) {
  // إعداد ترويسات الاستجابة (Headers) لدعم CORS ونوع المحتوى كـ JavaScript
  const headers = new Headers({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Access-Control-Allow-Origin': '*', // السماح بالوصول من أي نطاق (Domain)
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // إضافة تخزين مؤقت لتحسين الأداء (اختياري)
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
  });

  // استخراج المعامل name و userId من الرابط
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const userId = searchParams.get('userId');

  if (!name) {
    const errorScript = `console.error("Meta Pixel Dynamic API: Missing 'name' query parameter.");`;
    return new NextResponse(errorScript, { status: 400, headers });
  }

  try {
    // الاتصال بـ Firestore والبحث عن الربط المطابق
    const connectionsRef = userId
      ? collection(db, 'users', userId, 'integrations', 'meta', 'connections')
      : collection(db, 'integrations', 'meta', 'connections');
    const q = query(connectionsRef, where("name", "==", name));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      const notFoundScript = `console.error("Meta Pixel Dynamic API: No connection found with name '${name}'.");`;
      return new NextResponse(notFoundScript, { status: 404, headers });
    }

    // أخذ أول نتيجة مطابقة
    const docData = querySnapshot.docs[0].data();
    const pixelId = docData.pixelId;

    if (!pixelId) {
      const noPixelIdScript = `console.error("Meta Pixel Dynamic API: Connection found but 'pixelId' is missing.");`;
      return new NextResponse(noPixelIdScript, { status: 404, headers });
    }

    // كود Meta Pixel الأساسي كـ String خام
    const pixelScript = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      
      // تهيئة البيكسل باستخدام المعرف المجلوب
      fbq('init', '${pixelId}');
      
      // إطلاق حدث الصفحة
      fbq('track', 'PageView');
    `;

    // إرجاع الكود ليكون جاهزاً للتشغيل على أي صفحة خارجية
    return new NextResponse(pixelScript, { status: 200, headers });

  } catch (error) {
    console.error("Error fetching pixel API:", error);
    const serverErrorScript = `console.error("Meta Pixel Dynamic API: Internal server error.");`;
    return new NextResponse(serverErrorScript, { status: 500, headers });
  }
}

export async function OPTIONS() {
  // معالجة طلبات الـ Preflight لضمان عمل CORS بسلاسة
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
