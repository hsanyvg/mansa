import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST() {
  try {
    const adminUid = 'guAXkcygceeBkpwtFdf1n8O3dRX2';
    const customToken = await adminAuth.createCustomToken(adminUid);
    return NextResponse.json({ success: true, token: customToken, uid: adminUid });
  } catch (err: any) {
    console.error('Error generating restore token:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
