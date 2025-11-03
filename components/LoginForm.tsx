'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { SignUpSchema, SignInSchema } from '@/types/schemas';
import { authenticateWithPasskey } from '@/lib/passkey/client';

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please check your email and password.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}

export default function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate input with Zod
      const schema = isSignUp ? SignUpSchema : SignInSchema;
      const validation = schema.safeParse({ email, password });

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        setError(firstError.message);
        setLoading(false);
        return;
      }

      // Attempt authentication with Firebase
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        // Database sync happens automatically in AuthContext after auth state change
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // Database sync happens automatically in AuthContext after auth state change
      }

      // Success - redirect will happen via auth state change in AuthContext
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await authenticateWithPasskey(email || undefined);

      if (!result.success) {
        setError(result.error || 'Passkey authentication failed');
      }
      // Success - redirect will happen via auth state change in AuthContext
    } catch (err) {
      setError('An error occurred during passkey authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-zinc-900 dark:text-zinc-50">
            TripPlanner
          </h1>
          <p className="text-center text-zinc-600 dark:text-zinc-400 mb-8">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="tap-target w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {!isSignUp && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-700" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
                <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-700" />
              </div>

              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={loading}
                className="tap-target mt-4 w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold py-3 rounded-lg transition-colors border border-zinc-300 dark:border-zinc-600"
              >
                Sign in with Passkey
              </button>
            </>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="tap-target text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
