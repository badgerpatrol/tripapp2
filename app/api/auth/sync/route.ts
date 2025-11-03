import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenFromHeader } from '@/server/authz';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/server/eventLog';
import { EventType } from '@/lib/generated/prisma';

/**
 * POST /api/auth/sync
 * Syncs a Firebase user to the PostgreSQL database.
 * Called automatically after Firebase authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { uid, email } = auth;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required for authentication' },
        { status: 400 }
      );
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: uid },
    });

    let user;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user (in case profile changed in Firebase)
      user = await prisma.user.update({
        where: { id: uid },
        data: {
          email,
          updatedAt: new Date(),
        },
      });

      // Log sign in event
      await logEvent('User', uid, EventType.USER_SIGNED_IN, uid, {
        email,
        method: 'email/password',
      });
    } else {
      // Create new user
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          id: uid,
          email,
          displayName: null,
          photoURL: null,
          phoneNumber: null,
          timezone: 'UTC',
          language: 'en',
          defaultCurrency: 'GBP',
        },
      });

      // Log sign up event
      await logEvent('User', uid, EventType.USER_CREATED, uid, {
        email,
        method: 'email/password',
      });
    }

    // 3. Return user profile
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          phoneNumber: user.phoneNumber,
          role: user.role,
          subscription: user.subscription,
          timezone: user.timezone || 'UTC',
          language: user.language || 'en',
          defaultCurrency: user.defaultCurrency || 'USD',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        isNewUser,
      },
      { status: isNewUser ? 201 : 200 }
    );
  } catch (error) {
    console.error('Error syncing user to database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync user profile. Please try again.',
      },
      { status: 500 }
    );
  }
}
