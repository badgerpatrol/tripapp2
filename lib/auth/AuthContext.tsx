'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { UserProfile } from '@/types/schemas';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setError(null);

      if (firebaseUser) {
        // User is signed in - sync to database via API
        console.log('[AUTH] Firebase user authenticated:', firebaseUser.uid, firebaseUser.email);
        try {
          const idToken = await firebaseUser.getIdToken();
          console.log('[AUTH] Got ID token, calling /api/auth/sync');

          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });

          console.log('[AUTH] Sync response status:', response.status);
          const result = await response.json();
          console.log('[AUTH] Sync response data:', result);

          if (result.success && result.user) {
            setUserProfile(result.user);
            console.log('[AUTH] ✅ User synced to database:', result.isNewUser ? 'NEW USER' : 'EXISTING USER');
          } else {
            console.error('[AUTH] ❌ Failed to sync user to database:', result.error);
            setError(result.error || 'Failed to sync user profile');
          }
        } catch (err) {
          console.error('[AUTH] ❌ Error syncing user:', err);
          setError('Failed to sync user profile');
        }
      } else {
        // User is signed out
        console.log('[AUTH] User signed out');
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
