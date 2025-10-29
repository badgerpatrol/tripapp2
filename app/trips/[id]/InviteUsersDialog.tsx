"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface InviteUsersDialogProps {
  tripId: string;
  tripName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentMembers: Array<{
    id: string;
    role: string;
    rsvpStatus: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

export default function InviteUsersDialog({
  tripId,
  tripName,
  isOpen,
  onClose,
  onSuccess,
  currentMembers,
}: InviteUsersDialogProps) {
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invited: Array<{ email: string; userId: string; status: "invited" }>;
    alreadyMembers: Array<{ email: string; userId: string; status: "already_member" }>;
    notFound: Array<{ email: string; status: "not_found" }>;
  } | null>(null);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase();

    if (!trimmedEmail) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check for duplicates
    if (emails.includes(trimmedEmail)) {
      setError("This email has already been added");
      return;
    }

    setEmails([...emails, trimmedEmail]);
    setEmailInput("");
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (emails.length === 0) {
      setError("Please add at least one email address");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to invite users");
      }

      const idToken = await user.getIdToken();

      const response = await fetch(`/api/trips/${tripId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to send invitations (${response.status})`
        );
      }

      const data = await response.json();
      setResult({
        invited: data.invited || [],
        alreadyMembers: data.alreadyMembers || [],
        notFound: data.notFound || [],
      });

      // If all invitations were successful, show success and close after a delay
      if (data.invited.length === emails.length) {
        setTimeout(() => {
          onSuccess();
          onClose();
          // Reset state
          setEmails([]);
          setResult(null);
        }, 2000);
      }
    } catch (err) {
      console.error("Error inviting users:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send invitations. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset state after closing
      setTimeout(() => {
        setEmails([]);
        setEmailInput("");
        setError(null);
        setResult(null);
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Invite Users
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Invite people to join {tripName}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              disabled={isSubmitting}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {result && (
            <div className="mb-6 space-y-3">
              {result.invited.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    Successfully invited {result.invited.length} user{result.invited.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    {result.invited.map(item => (
                      <li key={item.email}>{item.email}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.alreadyMembers.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                    Already members ({result.alreadyMembers.length})
                  </p>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                    {result.alreadyMembers.map(item => (
                      <li key={item.email}>{item.email}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.notFound.length > 0 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                    Not registered ({result.notFound.length})
                  </p>
                  <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
                    {result.notFound.map(item => (
                      <li key={item.email}>{item.email} - User needs to create an account first</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Members Section */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Current Members ({currentMembers.length})
                </label>
              </div>
              <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800">
                <div className="space-y-1.5">
                  {currentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {(member.user.displayName || member.user.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {member.user.displayName || member.user.email}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {member.role}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                            member.rsvpStatus === "ACCEPTED"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : member.rsvpStatus === "DECLINED"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          {member.rsvpStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-300 dark:border-zinc-600"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Add New Members
                </span>
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  id="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="user@example.com"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  disabled={isSubmitting || !emailInput.trim()}
                  className="tap-target px-6 py-3 rounded-lg bg-zinc-600 hover:bg-zinc-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Press Enter or click Add to add the email to the list
              </p>
            </div>

            {/* Email List */}
            {emails.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Users to Invite ({emails.length})
                </label>
                <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg p-3 max-h-48 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="space-y-2">
                    {emails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between bg-white dark:bg-zinc-800 px-3 py-2 rounded-md"
                      >
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">
                          {email}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          disabled={isSubmitting}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    How Invitations Work
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Invited users will receive an in-app notification and will be added to the trip with PENDING status.
                    They can accept or decline the invitation from the trip page.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || emails.length === 0}
                className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : `Invite ${emails.length} User${emails.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
