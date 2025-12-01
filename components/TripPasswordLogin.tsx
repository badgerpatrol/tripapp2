"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useTripPasswordStore } from "@/lib/stores/tripPasswordStore";

interface TripPasswordLoginProps {
  tripId: string;
  tripName?: string;
  onFullAccountLogin: () => void;
}

/**
 * A simple password-only login form for public trip URLs.
 *
 * This component:
 * - Shows only a password field (no email visible to user)
 * - Validates the password against the trip's signUpPassword
 * - Signs in using the hidden viewer account
 * - Stores the password in memory for later re-use (e.g., switching to participant)
 */
export default function TripPasswordLogin({
  tripId,
  tripName,
  onFullAccountLogin,
}: TripPasswordLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setTripPassword } = useTripPasswordStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Validate password against the trip and get viewer email
      const response = await fetch(`/api/trips/${tripId}/viewer-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error || "Incorrect password for this trip");
        setLoading(false);
        return;
      }

      // 2. Sign in with Firebase using the hidden viewer email
      await signInWithEmailAndPassword(auth, data.viewerEmail, password);

      // 3. Store password in memory for later use (e.g., when user wants to participate)
      setTripPassword(tripId, password);

      // Success - auth state change will trigger re-render in parent
    } catch (err) {
      const authError = err as AuthError;
      // Map Firebase errors to generic messages
      if (authError.code === "auth/invalid-credential" || authError.code === "auth/wrong-password") {
        setError("Incorrect password for this trip");
      } else if (authError.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError("Incorrect password for this trip");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-zinc-900 dark:text-zinc-50">
            {tripName || "View Trip"}
          </h1>
          <p className="text-center text-zinc-600 dark:text-zinc-400 mb-8">
            Enter the trip password to view details
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Trip Password" htmlFor="tripPassword">
              <Input
                id="tripPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                minLength={1}
                autoFocus
              />
            </Field>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password}
              loading={loading}
              variant="primary"
              full
            >
              View Trip
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                or
              </span>
            </div>
          </div>

          {/* Full account login link */}
          <button
            type="button"
            onClick={onFullAccountLogin}
            className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Log in with my full account instead
          </button>
        </div>
      </div>
    </div>
  );
}
