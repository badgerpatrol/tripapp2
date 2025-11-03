'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import LoginForm from '@/components/LoginForm';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect logged-in users to /trips to see their invitations and trips
  useEffect(() => {
    if (!loading && user) {
      router.push('/trips');
    }
  }, [user, loading, router]);

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

  // While redirecting, show loading state
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-zinc-600 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}
