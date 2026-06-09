import { auth } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { uid, role } = await req.json();

    if (!uid || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['maker', 'checker', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    // Set custom claims with additional metadata
    await auth.setCustomUserClaims(uid, {
      role: role,
      createdAt: new Date().toISOString(),
      isActive: true
    });

    // Get the user to verify claims were set
    const user = await auth.getUser(uid);
    
    return NextResponse.json({ 
      success: true,
      user: {
        uid: user.uid,
        customClaims: user.customClaims
      }
    });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
