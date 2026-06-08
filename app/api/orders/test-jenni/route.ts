import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const integrationRef = doc(db, 'users', 'default_tenant', 'integrations', 'delivery');
    const integrationSnap = await getDoc(integrationRef);
    const integrationData = integrationSnap.data() || {};

    const loginRes = await fetch('https://almasara.jenni.delivery/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: integrationData.username,
        password: integrationData.password
      })
    });

    const loginData = await loginRes.json();
    const token = loginData.token.replace('Bearer ', '');

    const payload = {
      system_code: integrationData.systemCode || 'S001',
      shipments: [
        {
          shipment_number: 'TEST-333333',
          external_shipment_id: 'TEST-333333',
          receiver_name: 'Test Name',
          receiver_phone_1: '0770000000',
          amount_iqd: 5000,
          governorate_code: 1, // Baghdad
          city: 'Baghdad',
          receiver_address: 'Test Addr'
        }
      ]
    };

    const res = await fetch('https://almasara.jenni.delivery/api/v2/shipments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
