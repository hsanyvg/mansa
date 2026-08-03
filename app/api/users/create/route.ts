import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    try {
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
      });

      return NextResponse.json({ success: true, uid: userRecord.uid });
    } catch (authError: any) {
      console.error('Error creating user in Auth:', authError);
      return NextResponse.json({ error: authError.message, code: authError.code }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in create user endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
