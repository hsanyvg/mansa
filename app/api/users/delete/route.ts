import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }
    
    if (!uid) {
      return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log(`User ${uid} not found in Auth, skipping auth deletion.`);
      } else {
        throw authError; // Re-throw other errors
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
