"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { getAuthErrorMessage } from "@/components/LoginForm";

interface Participant {
  id: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

interface TripAccountSelectorProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
  tripName?: string;
  tripId: string;
  signUpPassword?: string | null;
  inline?: boolean; // When true, renders without modal wrapper
}

export default function TripAccountSelector({
  participants,
  isOpen,
  onClose,
  tripName,
  tripId,
  signUpPassword,
  inline = false,
}: TripAccountSelectorProps) {
  const [mode, setMode] = useState<"select" | "signin" | "signup">("select");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Generate a unique email from display name and trip ID
  const generateEmail = (name: string): string => {
    // Sanitize name: lowercase, replace spaces with dots, remove special chars
    const sanitized = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "");
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);
    return `${sanitized}.${timestamp}@${tripId}.trip`;
  };

  if (!isOpen) return null;

  const handleSelectParticipant = (participant: Participant) => {
    setSelectedEmail(participant.user.email);
    setMode("signin");
    setError("");
    setPassword("");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, selectedEmail, password);
      onClose();
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!displayName.trim()) {
        setError("Please enter your name");
        setLoading(false);
        return;
      }

      if (!signUpPassword) {
        setError("Sign-up is not enabled for this trip");
        setLoading(false);
        return;
      }

      const generatedEmail = generateEmail(displayName);
      const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, signUpPassword);

      // Set the display name on the Firebase user
      await updateProfile(userCredential.user, {
        displayName: displayName.trim(),
      });

      // The AuthContext will handle syncing the user to the database
      onClose();
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMode("select");
    setError("");
    setPassword("");
    setSelectedEmail("");
    setDisplayName("");
  };

  const getDisplayLabel = (participant: Participant) => {
    if (participant.user.displayName) {
      return participant.user.displayName;
    }
    return participant.user.email;
  };

  const content = (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {mode === "select" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Choose from the list below if you've been here before:
          </p>

          {/* Participant list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {participants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => handleSelectParticipant(participant)}
                className="w-full p-3 text-left rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {getDisplayLabel(participant)}
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500">or</span>
            </div>
          </div>

          {/* Create new account button */}
          <Button
            onClick={() => setMode("signup")}
            variant="outline"
            full
          >
            I'm new
          </Button>
        </div>
      )}

      {mode === "signin" && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm">
              {selectedEmail}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleBack}
              variant="outline"
              disabled={loading}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              className="flex-1"
            >
              Sign In
            </Button>
          </div>
        </form>
      )}

      {mode === "signup" && (
        <form onSubmit={handleSignUp} className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your name to join this trip:
          </p>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Your Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              placeholder="e.g., John Smith"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleBack}
              variant="outline"
              disabled={loading}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              className="flex-1"
            >
              Join Trip
            </Button>
          </div>
        </form>
      )}
    </>
  );

  // Inline mode - just return the content
  if (inline) {
    return content;
  }

  // Modal mode - wrap in modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {mode === "select" && "Switch Account"}
                {mode === "signin" && "Sign In"}
                {mode === "signup" && "Create Account"}
              </h2>
              {tripName && mode === "select" && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {tripName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {content}
        </div>
      </div>
    </div>
  );
}
