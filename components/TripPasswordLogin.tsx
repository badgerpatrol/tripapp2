"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useTripPasswordStore } from "@/lib/stores/tripPasswordStore";

interface Participant {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    userType: "FULL" | "SIGNUP" | "SYSTEM";
    emailHint: string | null;
  };
}

interface TripPublicInfo {
  tripId: string;
  tripName: string;
  signUpEnabled: boolean;
  signInEnabled: boolean;
  passwordRequired: boolean;
  passwordLoginAllowed: boolean;
  participants: Participant[];
}

interface TripPasswordLoginProps {
  tripId: string;
  tripName?: string;
  onFullAccountLogin: () => void;
  onSignUp?: () => void;
}

type Step = "password" | "select-invitee" | "full-account-password";

/**
 * A login form for public trip URLs that supports:
 * - Simple password-only viewer login
 * - Sign-in mode: select from list of invitees after entering trip password
 * - Sign-up mode: create a new account if not in the list
 */
export default function TripPasswordLogin({
  tripId,
  tripName,
  onFullAccountLogin,
  onSignUp,
}: TripPasswordLoginProps) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [fullAccountPassword, setFullAccountPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tripInfoLoading, setTripInfoLoading] = useState(true);
  const [tripInfo, setTripInfo] = useState<TripPublicInfo | null>(null);
  const [selectedMember, setSelectedMember] = useState<Participant | null>(null);
  const [selectedMemberEmail, setSelectedMemberEmail] = useState<string | null>(null);
  const { setTripPassword } = useTripPasswordStore();

  // Fetch trip public info on mount
  useEffect(() => {
    const fetchTripInfo = async () => {
      try {
        // Add cache-busting to ensure we always get fresh config
        const response = await fetch(`/api/trips/${tripId}/public`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTripInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch trip info:", err);
      } finally {
        setTripInfoLoading(false);
      }
    };
    fetchTripInfo();
  }, [tripId]);

  // If password login is not allowed (users with accounts only), redirect to full account login
  useEffect(() => {
    if (!tripInfoLoading && tripInfo && !tripInfo.passwordLoginAllowed) {
      onFullAccountLogin();
    }
  }, [tripInfoLoading, tripInfo, onFullAccountLogin]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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

      // Password is valid!
      // Store password in memory for later use
      setTripPassword(tripId, password);

      // Check if sign-in mode is enabled - if so, show invitee selector
      if (tripInfo?.signInEnabled && tripInfo.participants.length > 0) {
        setStep("select-invitee");
        setLoading(false);
        return;
      }

      // Otherwise, just sign in as viewer
      await signInWithEmailAndPassword(auth, data.viewerEmail, password);

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

  const handleInviteeSelect = async (participant: Participant) => {
    setError("");
    setLoading(true);
    setSelectedMember(participant);

    try {
      // Call invitee-login API to get credentials
      const response = await fetch(`/api/trips/${tripId}/invitee-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: participant.id,
          tripPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to sign in");
        setLoading(false);
        return;
      }

      if (data.userType === "SIGNUP") {
        // SIGNUP users can be logged in directly with trip password
        await signInWithEmailAndPassword(auth, data.email, data.password);
        // Success - auth state change will trigger re-render
      } else if (data.userType === "FULL") {
        // FULL users need to enter their own password
        setSelectedMemberEmail(data.email);
        setStep("full-account-password");
        setLoading(false);
      }
    } catch (err) {
      console.error("Invitee login error:", err);
      const authError = err as AuthError;
      if (authError.code === "auth/invalid-email") {
        setError("Account configuration error. Please contact the trip owner.");
      } else if (authError.code === "auth/invalid-credential" || authError.code === "auth/wrong-password") {
        setError("Failed to sign in. Please try again.");
      } else if (authError.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else if (authError.code === "auth/user-not-found") {
        setError("Account not found. Please contact the trip owner.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleFullAccountPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!selectedMemberEmail) {
        setError("No account selected");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, selectedMemberEmail, fullAccountPassword);
      // Success - auth state change will trigger re-render
    } catch (err) {
      const authError = err as AuthError;
      if (authError.code === "auth/invalid-credential" || authError.code === "auth/wrong-password") {
        setError("Incorrect password for your account");
      } else if (authError.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNoneOfThese = async () => {
    if (tripInfo?.signUpEnabled && onSignUp) {
      // Set the flag to open sign-up dialog after login
      onSignUp();
      // Then log in as viewer so the user can access the trip page
      await handleViewerLogin();
    }
  };

  const handleViewerLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/trips/${tripId}/viewer-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error || "Failed to sign in");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, data.viewerEmail, password);
    } catch (err) {
      setError("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while fetching trip info or if redirecting to full account login
  if (tripInfoLoading || (tripInfo && !tripInfo.passwordLoginAllowed)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-zinc-600 dark:text-zinc-400">
              {tripInfo && !tripInfo.passwordLoginAllowed
                ? "Redirecting to login..."
                : "Loading..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Password entry
  if (step === "password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center mb-2 text-zinc-900 dark:text-zinc-50">
              {tripName || tripInfo?.tripName || "View Trip"}
            </h1>
            <p className="text-center text-zinc-600 dark:text-zinc-400 mb-8">
              Enter the trip password to continue
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                Continue
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

  // Step 2: Select invitee (sign-in mode)
  if (step === "select-invitee") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
            <h1 className="text-2xl font-bold text-center mb-2 text-zinc-900 dark:text-zinc-50">
              Who are you?
            </h1>
            <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6">
              Select your name from the list
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tripInfo?.participants.map((participant) => (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => handleInviteeSelect(participant)}
                  disabled={loading}
                  className="w-full p-4 text-left rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {participant.user.displayName || "Unnamed"}
                  </div>
                  
                </button>
              ))}
            </div>

            {/* None of these button - only show if sign-up mode is enabled */}
            {tripInfo?.signUpEnabled && (
              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={handleNoneOfThese}
                  disabled={loading}
                  className="w-full p-3 text-center rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  None of these - Sign up instead
                </button>
              </div>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep("password")}
              className="w-full mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Full account password entry
  if (step === "full-account-password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
            <h1 className="text-2xl font-bold text-center mb-2 text-zinc-900 dark:text-zinc-50">
              Enter your password
            </h1>
            <p className="text-center text-zinc-600 dark:text-zinc-400 mb-2">
              Signing in as {selectedMember?.user.displayName || "User"}
            </p>
            {selectedMemberEmail && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                {selectedMemberEmail}
              </p>
            )}

            <form onSubmit={handleFullAccountPasswordSubmit} className="space-y-4">
              <Field label="Your Account Password" htmlFor="accountPassword">
                <Input
                  id="accountPassword"
                  type="password"
                  value={fullAccountPassword}
                  onChange={(e) => setFullAccountPassword(e.target.value)}
                  placeholder="Enter your password"
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
                disabled={loading || !fullAccountPassword}
                loading={loading}
                variant="primary"
                full
              >
                Sign In
              </Button>
            </form>

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setStep("select-invitee");
                setFullAccountPassword("");
                setError("");
              }}
              className="w-full mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              ← Back to invitee list
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
