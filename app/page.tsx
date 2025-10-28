'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import LoginForm from '@/components/LoginForm';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // User is logged in - show dashboard
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Welcome to TripPlanner
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                Logged in as: {user.email}
              </p>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
              style={{ minHeight: 'var(--tap-target-min)' }}
            >
              Sign Out
            </button>
          </div>
          
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400 text-lg">
              Your trip dashboard will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
