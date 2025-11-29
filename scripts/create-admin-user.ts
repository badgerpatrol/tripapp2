/**
 * Script to create an admin user in both Firebase and the database
 *
 * Usage: npx tsx scripts/create-admin-user.ts
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient, UserRole, EventType } from '../lib/generated/prisma';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@test.com';
  const password = 'admintest';
  const displayName = 'Admin';

  console.log('Creating admin user...');
  console.log('Email:', email);

  // Initialize Firebase Admin
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

  const adminAuth = getAuth(app);

  // Check if user already exists in Firebase
  let firebaseUser;
  try {
    firebaseUser = await adminAuth.getUserByEmail(email);
    console.log('User already exists in Firebase:', firebaseUser.uid);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'auth/user-not-found') {
      // Create user in Firebase
      console.log('Creating user in Firebase...');
      firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      console.log('User created in Firebase:', firebaseUser.uid);
    } else {
      throw error;
    }
  }

  // Check if user exists in database
  const existingDbUser = await prisma.user.findUnique({
    where: { id: firebaseUser.uid },
  });

  if (existingDbUser) {
    // Update to admin role if not already
    if (existingDbUser.role !== UserRole.ADMIN) {
      await prisma.user.update({
        where: { id: firebaseUser.uid },
        data: { role: UserRole.ADMIN },
      });
      console.log('Updated existing user to ADMIN role');
    } else {
      console.log('User already exists in database with ADMIN role');
    }
  } else {
    // Create user in database with ADMIN role
    console.log('Creating user in database...');
    await prisma.user.create({
      data: {
        id: firebaseUser.uid,
        email,
        displayName,
        role: UserRole.ADMIN,
        timezone: 'UTC',
        language: 'en',
        defaultCurrency: 'GBP',
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        entity: 'User',
        entityId: firebaseUser.uid,
        eventType: EventType.USER_CREATED,
        byUser: firebaseUser.uid,
        payload: {
          email,
          method: 'script',
          role: 'ADMIN',
        },
      },
    });

    console.log('User created in database with ADMIN role');
  }

  console.log('\n✓ Admin user setup complete!');
  console.log('  Email:', email);
  console.log('  Password:', password);
  console.log('  Role: ADMIN');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
