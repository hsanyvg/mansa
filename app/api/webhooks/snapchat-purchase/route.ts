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
      orderId, productId, productName, quantity, value, currency, email, phone, firstName,
      client_ip, user_agent, event_source_url, userId 
    } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId parameter' }, { status: 400, headers: corsHeaders });
    }

    const connectionsRef = userId
      ? adminDb!.collection('users').doc(userId).collection('integrations').doc('snapchat').collection('connections')
      : adminDb!.collection('integrations').doc('snapchat').collection('connections');

    let querySnapshot: any = { empty: true, docs: [] };
    
    if (body.pixelDocId) {
      // Smart routing: Fetch exact pixel
      const docRef = connectionsRef.doc(body.pixelDocId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        querySnapshot = { empty: false, docs: [docSnap] };
      }
    } else {
      // Query pixels linked to this product
      querySnapshot = await connectionsRef.where('linkedProducts', 'array-contains', productId).get();
      
      // Fallback: If no pixel is linked to this specific product, use ALL snapchat pixels for this user
      if (querySnapshot.empty) {
        querySnapshot = await connectionsRef.get();
      }
    }

    if (querySnapshot.empty) {
      return NextResponse.json({ message: 'No Snapchat pixel configured.' }, { status: 200, headers: corsHeaders });
    }

    const promises = querySnapshot.docs.map(async (doc: any) => {
      const { pixelId, accessToken, testEventCode } = doc.data();

      if (!pixelId) return { status: 'rejected', reason: 'Missing pixelId' };

      // If user hasn't provided a Conversions API Access Token, we skip the CAPI call safely
      if (!accessToken || accessToken.trim() === '') {
        return { pixelId, status: 'skipped', reason: 'No Conversions API token provided (browser pixel tracking only)' };
      }

      const snapPayload: any = {
        version: '2.0',
        pixel_id: pixelId,
        event_type: 'PURCHASE',
        event_conversion_type: 'WEB',
        timestamp: Date.now().toString(),
        price: value ? Number(value) : 0,
        currency: currency || 'IQD',
        transaction_id: orderId ? `ord_${orderId}` : undefined,
        item_ids: productId ? [String(productId)] : [],
        item_category: productName || 'Unknown Product',
        number_items: quantity ? Number(quantity) : 1,
        hashed_phone_number: hashData(phone, true),
        hashed_email: hashData(email),
        hashed_first_name: hashData(firstName),
        client_ip_address: client_ip,
        client_user_agent: user_agent,
        event_source_url: event_source_url || 'https://example.com'
      };

      if (testEventCode && testEventCode.trim() !== '') {
        snapPayload.event_tag = testEventCode.trim();
      }

      const snapUrl = 'https://tr.snapchat.com/v2/conversion';
      const snapResponse = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapPayload)
      });

      const snapResponseData = await snapResponse.json().catch(() => ({}));

      if (!snapResponse.ok) {
        console.error('Snapchat Conversions API Error:', snapResponseData);
        throw new Error(JSON.stringify(snapResponseData));
      }

      return { pixelId, snapResponseData };
    });

    const results = await Promise.allSettled(promises);
    return NextResponse.json({ success: true, results }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Snapchat Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
