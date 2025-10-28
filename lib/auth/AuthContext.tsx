'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { syncUserToDatabase } from '@/server/actions/auth';
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
        // User is signed in - sync to database
        try {
          const idToken = await firebaseUser.getIdToken();
          const result = await syncUserToDatabase(idToken);

          if (result.success && result.user) {
            setUserProfile(result.user);
          } else {
            console.error('Failed to sync user to database:', result.error);
            setError(result.error || 'Failed to sync user profile');
          }
        } catch (err) {
          console.error('Error syncing user:', err);
          setError('Failed to sync user profile');
        }
      } else {
        // User is signed out
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
