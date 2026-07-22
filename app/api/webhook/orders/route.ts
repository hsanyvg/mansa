import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Webhook is running. Please send a POST request with order data.',
  });
}

export async function POST(request: Request) {
  try {
    const incomingApiKey = request.headers.get('x-api-key');
    const userId = process.env.USER_ID || 'guAXkcygceeBkpwtFdf1n8O3dRX2';

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Internal Server Error: Database not initialized' },
        { status: 500 }
      );
    }

    // Fetch integration config from Firestore
    const integrationDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('integrations')
      .doc('webhook')
      .get();

    let validApiKey = process.env.API_KEY; // Fallback to env
    let isWebhookActive = true;

    if (integrationDoc.exists) {
      const data = integrationDoc.data();
      if (data?.apiKey) validApiKey = data.apiKey;
      if (data?.isActive === false) isWebhookActive = false;
    }

    if (!isWebhookActive) {
      return NextResponse.json(
        { error: 'Forbidden: Webhook is currently disabled by the administrator' },
        { status: 403 }
      );
    }

    if (!validApiKey || incomingApiKey !== validApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API Key' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { customerName, phoneNumber, governorate, productName, quantity, totalPrice } = body;

    // 3. Basic validation of required fields
    if (!customerName || !phoneNumber || !governorate || !productName || !quantity || !totalPrice) {
      return NextResponse.json(
        { error: 'Bad Request: Missing required fields' },
        { status: 400 }
      );
    }



    // 4. Prepare Order Object
    // Dashboard expects an 'id' field usually for the sequential number.
    const randomSequentialId = Math.floor(100000 + Math.random() * 900000).toString();

    const newOrder = {
      id: randomSequentialId,
      customerName,
      phoneNumber,
      governorate,
      productName,
      quantity: Number(quantity),
      totalPrice: Number(totalPrice),
      status: 'جديد', // Default status: New
      createdAt: new Date().toISOString(),
      source: 'Landing Page Webhook',
      timestamp: new Date().getTime(), // Some dashboards use timestamp
      systemUser: 'Landing Page', // Shows up as 'مستخدم النظام' in dashboard
    };

    // 5. Save to Firebase Firestore under the specific user's orders
    // userId is already defined above
    
    const docRef = await adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .add(newOrder);

    // 6. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        orderId: randomSequentialId,
        order_id: randomSequentialId,
        id: randomSequentialId,
        firebaseId: docRef.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
