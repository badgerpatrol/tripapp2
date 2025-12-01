'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

interface TripParticipant {
  id: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  role: string;
}

interface JoinTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  participants: TripParticipant[];
  onLoginRequired: (email: string) => void;
}

function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'auth/invalid-credential':
      return 'Invalid password. Please try again.';
    case 'auth/user-not-found':
      return 'Account not found. Please select a valid user or create a new account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return error.message || 'Login failed. Please try again.';
  }
}

type Step = 'select' | 'newUser' | 'login';

export function JoinTripDialog({
  isOpen,
  onClose,
  tripId,
  tripName,
  participants,
  onLoginRequired,
}: JoinTripDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  // Filter to show only users created through the trip join flow (with .fake emails)
  // but exclude the viewer account (tripplanner.local emails)
  // These are the accounts that can be logged into with the trip password
  const joinableParticipants = participants.filter(
    (p) => p.user.email.endsWith('.fake') && !p.user.email.endsWith('@tripplanner.local')
  );

  const handleReset = () => {
    setStep('select');
    setSelectedUserId('');
    setNewName('');
    setPassword('');
    setError('');
    setLoading(false);
    setPendingEmail('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelectExisting = (userId: string) => {
    setSelectedUserId(userId);
    setStep('login');
    setError('');

    // Find the user's email
    const participant = joinableParticipants.find(p => p.user.id === userId);
    if (participant) {
      setPendingEmail(participant.user.email);
    }
  };

  const handleNewUser = () => {
    setStep('newUser');
    setError('');
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedUserId('');
    setNewName('');
    setError('');
  };

  const handleCreateAndLogin = async () => {
    if (!newName.trim()) {
      setError('Please enter your name');
      return;
    }

    // Check if name already exists among trip participants (case-insensitive)
    const trimmedName = newName.trim().toLowerCase();
    const existingParticipant = participants.find(
      (p) => p.user.displayName?.toLowerCase() === trimmedName
    );

    if (existingParticipant) {
      setError(`The name "${newName.trim()}" is already taken on this trip. Please choose a different name.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call the API to create a new user account
      const response = await fetch(`/api/trips/${tripId}/join-new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: newName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Set the email for login and move to login step
      setPendingEmail(data.email);
      setStep('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError('Please enter the trip password');
      return;
    }

    if (!pendingEmail) {
      setError('No account selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First verify the password is correct via our API
      // This prevents unnecessary Firebase login attempts
      const verifyResponse = await fetch(`/api/trips/${tripId}/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.valid) {
        throw new Error(verifyData.error || 'Invalid password');
      }

      // Password is valid - now sign in with Firebase
      // The password for the trip account is the same as the signUpPassword
      await signInWithEmailAndPassword(auth, pendingEmail, password);

      // Success! Auth state change will trigger re-render with new user
      handleClose();
    } catch (err) {
      if ((err as AuthError).code) {
        setError(getAuthErrorMessage(err as AuthError));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to log in');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = joinableParticipants.find(p => p.user.id === selectedUserId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join Trip"
      size="md"
    >
      {step === 'select' && (
        <div className="space-y-6">
          <p className="text-zinc-600 dark:text-zinc-400">
            Already done this...:
          </p>

          {/* List of existing joinable participants */}
          <div className="space-y-2">
            {joinableParticipants.map((participant) => (
              <button
                key={participant.user.id}
                onClick={() => handleSelectExisting(participant.user.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {(participant.user.displayName ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {participant.user.displayName ?? "Unknown"}
                  </p>
                </div>
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">or</span>
            </div>
          </div>

          {/* I'm new here button */}
          <button
            onClick={handleNewUser}
            className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              I'm new here
            </span>
          </button>
        </div>
      )}

      {step === 'newUser' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <button
              onClick={handleBackToSelect}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Select account
            </button>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">New account</span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            Enter your name to create a new account:
          </p>

          <Field label="Your Name" htmlFor="newName">
            <Input
              id="newName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
          </Field>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleBackToSelect}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateAndLogin}
              loading={loading}
              disabled={loading || !newName.trim()}
              full
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'login' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <button
              onClick={handleBackToSelect}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Select account
            </button>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Login</span>
          </div>

          {selectedUser ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  {(selectedUser.user.displayName || selectedUser.user.email)[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedUser.user.displayName || selectedUser.user.email}
                </p>
              </div>
            </div>
          ) : pendingEmail && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Added {newName}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Please re-enter the trip password to log in
                </p>
              </div>
            </div>
          )}

          <Field label="Trip Password" htmlFor="tripPassword">
            <Input
              id="tripPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter trip password"
              autoFocus
            />
          </Field>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleBackToSelect}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleLogin}
              loading={loading}
              disabled={loading || !password}
              full
            >
              Log In
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
