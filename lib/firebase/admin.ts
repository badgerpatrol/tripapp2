import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
}

let serviceAccount: Record<string, string>;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (error) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount),
    });

export const adminAuth = getAuth(app);
