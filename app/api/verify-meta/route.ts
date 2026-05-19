import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, adAccountId } = await request.json();

    if (!accessToken || !adAccountId) {
      return NextResponse.json({ error: 'الرجاء إدخال رمز الوصول ومعرف الحساب الإعلاني.' }, { status: 400 });
    }

    // Format the adAccountId to ensure it starts with act_
    const formattedAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Verify against Meta Graph API by fetching the account name and status
    const url = `https://graph.facebook.com/v19.0/${formattedAdAccountId}?fields=name,account_status,currency&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta Verification API Error:', data.error);
      return NextResponse.json({ 
        success: false, 
        error: data.error.message || 'فشل التحقق من البيانات. تأكد من صحة الرمز والمعرف ومنح الصلاحيات.' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      name: data.name,
      currency: data.currency,
      account_status: data.account_status 
    });
  } catch (error: any) {
    console.error('Error in verify-meta API:', error);
    return NextResponse.json({ error: 'حدث خطأ داخلي في الخادم.' }, { status: 500 });
  }
}
