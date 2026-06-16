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

    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    // Even if it fails (e.g. user not found), we should probably let the client delete the firestore doc
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
