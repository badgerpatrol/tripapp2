import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return NextResponse.json({ uid: decoded.uid, email: decoded.email });
  } catch (error) {
    console.error('Token verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 403 }
    );
  }
}
