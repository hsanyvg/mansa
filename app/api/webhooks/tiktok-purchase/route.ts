import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';
import crypto from 'crypto';

const hashData = (data: string | undefined | null, isPhone: boolean = false) => {
  if (!data) return undefined;
  let trimmed = data.trim().toLowerCase();
  if (isPhone) {
    trimmed = trimmed.replace(/\D/g, ''); // Remove non-digits
    if (trimmed.startsWith('07') && trimmed.length === 11) {
      trimmed = '964' + trimmed.substring(1);
    } else if (trimmed.startsWith('7') && trimmed.length === 10) {
      trimmed = '964' + trimmed;
    }
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      orderId, productId, productName, quantity, value, currency, email, phone, firstName, lastName, city, state, 
      client_ip, user_agent, event_source_url, userId 
    } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId parameter' }, { status: 400, headers: corsHeaders });
    }

    const connectionsRef = userId
      ? adminDb!.collection('users').doc(userId).collection('integrations').doc('tiktok').collection('connections')
      : adminDb!.collection('integrations').doc('tiktok').collection('connections');
    let querySnapshot = await connectionsRef.where('linkedProducts', 'array-contains', productId).get();
    
    // Fallback: If no pixel is linked to this specific product (e.g. name mismatch from landing page), use ALL pixels for this user
    if (querySnapshot.empty) {
      querySnapshot = await connectionsRef.get();
    }

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'No TikTok pixel found.' }, { status: 404, headers: corsHeaders });
    }

    const userData: any = {};
    if (email) userData.email = hashData(email);
    if (phone) userData.phone_number = hashData(phone, true); // Pass true for isPhone
    if (client_ip) userData.client_ip_address = client_ip;
    if (user_agent) userData.client_user_agent = user_agent;

    const eventTime = new Date().toISOString();

    const promises = querySnapshot.docs.map(async (doc) => {
      const { pixelId, accessToken, testEventCode } = doc.data();

      if (!pixelId || !accessToken) return { status: 'rejected', reason: 'Missing credentials' };

      const tiktokPayload: any = {
        pixel_code: pixelId,
        event: 'PlaceAnOrder',
        event_id: orderId ? `ord_${orderId}_${eventTime}` : undefined,
        timestamp: eventTime,
        context: {
          user: userData,
          page: { url: event_source_url || 'https://example.com' }
        },
        properties: {
          contents: [{ 
            price: value ? Number(value) : 0, 
            quantity: quantity ? Number(quantity) : 1, 
            content_id: productId,
            content_name: productName || 'Unknown Product',
            content_type: 'product'
          }],
          value: value ? Number(value) : 0,
          currency: currency || 'IQD',
          order_id: orderId
        }
      };

      if (testEventCode && testEventCode.trim() !== '') {
        tiktokPayload.test_event_code = testEventCode.trim();
      }

      const tiktokUrl = 'https://business-api.tiktok.com/open_api/v1.3/pixel/track/';
      const tiktokResponse = await fetch(tiktokUrl, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tiktokPayload)
      });

      const tiktokResponseData = await tiktokResponse.json();

      if (!tiktokResponse.ok || tiktokResponseData.code !== 0) {
        console.error('TikTok Events API Error:', tiktokResponseData);
        throw new Error(JSON.stringify(tiktokResponseData));
      }

      return { pixelId, tiktokResponseData };
    });

    const results = await Promise.allSettled(promises);
    return NextResponse.json({ success: true, results }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
