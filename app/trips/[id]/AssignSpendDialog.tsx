"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface Participant {
  id: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

interface Spend {
  id: string;
  description: string;
  amount: number;
  currency: string;
  assignments?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

interface AssignSpendDialogProps {
  spend: Spend;
  participants: Participant[];
  tripId: string;
  tripRsvpStatus?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignSpendDialog({
  spend,
  participants,
  tripId,
  tripRsvpStatus,
  isOpen,
  onClose,
  onSuccess,
}: AssignSpendDialogProps) {
  const { user } = useAuth();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberRsvpFilter, setMemberRsvpFilter] = useState<"all" | "PENDING" | "ACCEPTED" | "DECLINED" | "MAYBE">("all");

  // Initialize with already assigned users
  useEffect(() => {
    if (spend.assignments && spend.assignments.length > 0) {
      setSelectedUserIds(new Set(spend.assignments.map((a) => a.userId)));
    } else {
      setSelectedUserIds(new Set());
    }
  }, [spend.id, spend.assignments]);

  // Set default filter based on trip RSVP status
  useEffect(() => {
    if (tripRsvpStatus === "CLOSED") {
      setMemberRsvpFilter("ACCEPTED");
    } else {
      setMemberRsvpFilter("all");
    }
  }, [tripRsvpStatus]);

  if (!isOpen) return null;

  // Get filtered participants based on RSVP status
  const getFilteredParticipants = () => {
    // Filter by selected RSVP status
    if (memberRsvpFilter !== "all") {
      return participants.filter((p) => {
        // Check if participant has rsvpStatus property (from the trip's participants array)
        const participant = p as any;
        return participant.rsvpStatus === memberRsvpFilter;
      });
    }

    return participants;
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to assign users");
      }

      if (selectedUserIds.size === 0) {
        throw new Error("Please select at least one user to involve in this spend");
      }

      const idToken = await user.getIdToken();

      // Create assignments with shareAmount = 0 for newly involved users
      // For existing users, the backend will preserve their existing allocations
      const assignments = Array.from(selectedUserIds).map((userId) => ({
        userId,
        shareAmount: 0,
        normalizedShareAmount: 0,
        splitType: "EQUAL" as const, // Default, they can change later
      }));

      const response = await fetch(`/api/spends/${spend.id}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments,
          replaceAll: true, // Replace existing assignments with the new list
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to assign users");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Who was this for?
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Select who was involved in: <span className="font-medium">{spend.description}</span>
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
            Amount: {spend.currency} {spend.amount.toFixed(2)}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* RSVP Filter Dropdown */}
            <div className="mb-4">
              <label htmlFor="assign-member-filter" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Filter by RSVP Status
              </label>
              <select
                id="assign-member-filter"
                value={memberRsvpFilter}
                onChange={(e) => setMemberRsvpFilter(e.target.value as typeof memberRsvpFilter)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">All Members</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PENDING">Pending</option>
                <option value="MAYBE">Maybe</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>

            <div className="space-y-2">


              {getFilteredParticipants().map((participant) => {
                const isSelected = selectedUserIds.has(participant.user.id);
                const displayName = participant.user.displayName || participant.user.email;

                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => handleToggleUser(participant.user.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500"
                        : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>

                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {displayName[0].toUpperCase()}
                      </span>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {participant.user.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedUserIds.size === 0}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
