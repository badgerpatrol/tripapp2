'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useTripPasswordStore } from '@/lib/stores/tripPasswordStore';

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
  onParticipantCreated?: () => void;
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

type Step = 'select' | 'newUser' | 'login' | 'fullAccountLogin';

export function JoinTripDialog({
  isOpen,
  onClose,
  tripId,
  tripName,
  participants,
  onLoginRequired,
  onParticipantCreated,
}: JoinTripDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [fullAccountEmail, setFullAccountEmail] = useState('');
  const [fullAccountPassword, setFullAccountPassword] = useState('');
  const [tripPassword, setTripPassword] = useState('');

  // Filter to show only users created through the trip join flow (with .fake emails)
  // but exclude the viewer account (tripplanner.local emails)
  // These are the accounts that can be logged into with the trip password
  const joinableParticipants = participants.filter(
    (p) => !p.user.email.endsWith('@tripplanner.local')
  );

  // Check if this is a trip-created account (.fake email)
  const isTripCreatedAccount = (email: string) => email.endsWith('.fake');

  // Auto-login using stored password for .fake accounts
  const attemptAutoLogin = async (email: string) => {
    // Get the password fresh from the store to avoid stale closure
    const currentPassword = useTripPasswordStore.getState().getTripPassword(tripId);

    console.log('[JoinTripDialog] attemptAutoLogin called', {
      email,
      hasPassword: !!currentPassword,
      isFakeAccount: isTripCreatedAccount(email),
      tripId,
    });

    if (!currentPassword || !isTripCreatedAccount(email)) {
      // No stored password or not a .fake account - show manual login
      console.log('[JoinTripDialog] Falling back to manual login - no stored password or not .fake account');
      setPendingEmail(email);
      setStep('login');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify password is still valid
      const verifyResponse = await fetch(`/api/trips/${tripId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.valid) {
        // Password no longer valid - fall back to manual entry
        setPendingEmail(email);
        setStep('login');
        return;
      }

      // Sign in with Firebase
      await signInWithEmailAndPassword(auth, email, currentPassword);
      handleClose();
    } catch (err) {
      // On any error, fall back to manual password entry
      setPendingEmail(email);
      setStep('login');
      if ((err as AuthError).code) {
        setError(getAuthErrorMessage(err as AuthError));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedUserId('');
    setNewName('');
    setPassword('');
    setError('');
    setLoading(false);
    setPendingEmail('');
    setFullAccountEmail('');
    setFullAccountPassword('');
    setTripPassword('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelectExisting = (userId: string) => {
    setSelectedUserId(userId);
    setError('');

    // Find the user's email
    const participant = joinableParticipants.find(p => p.user.id === userId);
    if (participant) {
      // Try auto-login with stored password for .fake accounts
      attemptAutoLogin(participant.user.email);
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
    setFullAccountEmail('');
    setFullAccountPassword('');
    setTripPassword('');
  };

  const handleFullAccountLogin = () => {
    setStep('fullAccountLogin');
    setError('');
  };

  const handleFullAccountSubmit = async () => {
    if (!fullAccountEmail.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!fullAccountPassword) {
      setError('Please enter your password');
      return;
    }
    if (!tripPassword) {
      setError('Please enter the trip password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Sign in with Firebase using full account credentials
      const userCredential = await signInWithEmailAndPassword(auth, fullAccountEmail.trim(), fullAccountPassword);

      // Get the Firebase token
      const token = await userCredential.user.getIdToken();

      // Join the trip using the trip password
      const joinResponse = await fetch(`/api/trips/${tripId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: tripPassword }),
      });

      const joinData = await joinResponse.json();

      if (!joinResponse.ok) {
        throw new Error(joinData.error || 'Failed to join trip');
      }

      // Notify parent to refresh participants list
      onParticipantCreated?.();

      // Success - close the dialog
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

      // Notify parent to refresh participants list
      onParticipantCreated?.();

      // Try auto-login with stored password for the new .fake account
      // Note: setLoading(false) will be called in attemptAutoLogin's finally block
      await attemptAutoLogin(data.email);
      return; // Don't call setLoading(false) again
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError(isTripCreatedAccount(pendingEmail) ? 'Please enter the trip password' : 'Please enter your account password');
      return;
    }

    if (!pendingEmail) {
      setError('No account selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isTripCreatedAccount(pendingEmail)) {
        // For trip-created accounts (.fake), verify against trip password first
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
          throw new Error(verifyData.error || 'Invalid trip password');
        }
      }

      // Sign in with Firebase
      // For .fake accounts: password is the trip password
      // For real accounts: password is their account password
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

          {/* Log in with full account button */}
          <button
            onClick={handleFullAccountLogin}
            className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Log in with my account
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
            <span className="text-zinc-900 dark:text-zinc-100">Join without account</span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            Enter a name to join just this trip if you don't have an account
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

          <Field
            label={isTripCreatedAccount(pendingEmail) ? "Trip Password" : "Account Password"}
            htmlFor="tripPassword"
          >
            <Input
              id="tripPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isTripCreatedAccount(pendingEmail) ? "Enter trip password" : "Enter your account password"}
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

      {step === 'fullAccountLogin' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <button
              onClick={handleBackToSelect}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Select account
            </button>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Log in with account</span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            Log in with your existing account to join this trip:
          </p>

          <Field label="Email" htmlFor="fullAccountEmail">
            <Input
              id="fullAccountEmail"
              type="email"
              value={fullAccountEmail}
              onChange={(e) => setFullAccountEmail(e.target.value)}
              placeholder="Enter your email"
              autoFocus
            />
          </Field>

          <Field label="Account Password" htmlFor="fullAccountPassword">
            <Input
              id="fullAccountPassword"
              type="password"
              value={fullAccountPassword}
              onChange={(e) => setFullAccountPassword(e.target.value)}
              placeholder="Enter your account password"
            />
          </Field>

          <Field label="Trip Password" htmlFor="tripPasswordField">
            <Input
              id="tripPasswordField"
              type="password"
              value={tripPassword}
              onChange={(e) => setTripPassword(e.target.value)}
              placeholder="Enter the trip password"
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
              onClick={handleFullAccountSubmit}
              loading={loading}
              disabled={loading || !fullAccountEmail.trim() || !fullAccountPassword || !tripPassword}
              full
            >
              Log In & Join Trip
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
