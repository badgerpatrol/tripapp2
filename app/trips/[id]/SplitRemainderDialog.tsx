"use client";

import { useState, useEffect } from "react";

type SplitMode = "equal" | "proportional";

interface Assignment {
  id: string;
  userId: string;
  shareAmount: number;
  normalizedShareAmount: number;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

interface Participant {
  id: string;
  email: string;
  displayName: string | null;
}

interface SplitRemainderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (assignments: Assignment[]) => Promise<void>;
  spend: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    normalizedAmount: number;
    fxRate: number;
  };
  trip: {
    baseCurrency: string;
  };
  existingAssignments: Assignment[];
  allParticipants: Participant[];
  currentUserId: string;
}

export default function SplitRemainderDialog({
  isOpen,
  onClose,
  onApply,
  spend,
  trip,
  existingAssignments,
  allParticipants,
  currentUserId,
}: SplitRemainderDialogProps) {
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate remainder
  const totalAssigned = existingAssignments.reduce((sum, a) => sum + (a.shareAmount || 0), 0);
  const remainder = spend.amount - totalAssigned;
  const remainderPercentage = (remainder / spend.amount) * 100;

  // Initialize selected users to all existing assignments on open (or empty if none)
  useEffect(() => {
    if (isOpen) {
      const userIds = new Set(existingAssignments.map(a => a.userId));
      setSelectedUserIds(userIds);
      setError(null);
    }
  }, [isOpen, existingAssignments]);

  if (!isOpen) return null;

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  // Create a map of existing assignments for quick lookup
  const existingAssignmentMap = new Map(
    existingAssignments.map(a => [a.userId, a])
  );

  // Build list of all users to show (participants with assignment data if it exists)
  const availableUsers = allParticipants.map(p => {
    const existing = existingAssignmentMap.get(p.id);
    return {
      id: p.id,
      user: {
        id: p.id,
        email: p.email,
        displayName: p.displayName,
      },
      shareAmount: existing?.shareAmount || 0,
      normalizedShareAmount: existing?.normalizedShareAmount || 0,
    };
  });

  const calculatePreview = (): Assignment[] => {
    if (selectedUserIds.size === 0) {
      // Return existing assignments unchanged if no one is selected
      return existingAssignments;
    }

    // Get selected and unselected from availableUsers
    const selectedUsers = availableUsers.filter(u => selectedUserIds.has(u.id));
    const unselectedUsers = availableUsers.filter(u => !selectedUserIds.has(u.id) && u.shareAmount > 0);

    if (splitMode === "equal") {
      // Equal split: divide remainder equally among selected users
      const splitAmount = remainder / selectedUserIds.size;

      // Create assignments for all selected users with their updated amounts
      const selectedAssignments = selectedUsers.map(u => ({
        id: existingAssignmentMap.get(u.id)?.id || u.id,
        userId: u.id,
        user: u.user,
        shareAmount: u.shareAmount + splitAmount,
        normalizedShareAmount: (u.shareAmount + splitAmount) * spend.fxRate,
      }));

      // Keep unselected assignments unchanged
      const unselectedAssignments = unselectedUsers.map(u => ({
        id: existingAssignmentMap.get(u.id)!.id,
        userId: u.id,
        user: u.user,
        shareAmount: u.shareAmount,
        normalizedShareAmount: u.normalizedShareAmount,
      }));

      return [...unselectedAssignments, ...selectedAssignments];
    } else {
      // Proportional split: distribute based on current share percentages
      const totalSelectedShare = selectedUsers.reduce((sum, u) => sum + u.shareAmount, 0);

      if (totalSelectedShare === 0) {
        // If no one has any share yet, fall back to equal split
        const splitAmount = remainder / selectedUserIds.size;
        const selectedAssignments = selectedUsers.map(u => ({
          id: existingAssignmentMap.get(u.id)?.id || u.id,
          userId: u.id,
          user: u.user,
          shareAmount: splitAmount,
          normalizedShareAmount: splitAmount * spend.fxRate,
        }));

        const unselectedAssignments = unselectedUsers.map(u => ({
          id: existingAssignmentMap.get(u.id)!.id,
          userId: u.id,
          user: u.user,
          shareAmount: u.shareAmount,
          normalizedShareAmount: u.normalizedShareAmount,
        }));

        return [...unselectedAssignments, ...selectedAssignments];
      }

      // Proportional distribution
      const selectedAssignments = selectedUsers.map(u => {
        const proportion = u.shareAmount / totalSelectedShare;
        const additionalAmount = remainder * proportion;
        return {
          id: existingAssignmentMap.get(u.id)?.id || u.id,
          userId: u.id,
          user: u.user,
          shareAmount: u.shareAmount + additionalAmount,
          normalizedShareAmount: (u.shareAmount + additionalAmount) * spend.fxRate,
        };
      });

      const unselectedAssignments = unselectedUsers.map(u => ({
        id: existingAssignmentMap.get(u.id)!.id,
        userId: u.id,
        user: u.user,
        shareAmount: u.shareAmount,
        normalizedShareAmount: u.normalizedShareAmount,
      }));

      return [...unselectedAssignments, ...selectedAssignments];
    }
  };

  const previewAssignments = calculatePreview();

  const handleApply = async () => {
    if (selectedUserIds.size === 0) {
      setError("Please select at least one participant to split the remainder among");
      return;
    }

    if (remainder <= 0) {
      setError("There is no remainder to split");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onApply(previewAssignments);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split remainder");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Split Remainder
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Spend Info */}
          <div className="mb-6 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Spend
            </p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              {spend.description}
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Total: {spend.currency} {spend.amount.toFixed(2)}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                Assigned: {spend.currency} {totalAssigned.toFixed(2)} ({(100 - remainderPercentage).toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Unassigned Remainder:
                </span>
                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {spend.currency} {remainder.toFixed(2)} ({remainderPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Split Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Split Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSplitMode("equal")}
                disabled={isSubmitting}
                className={`p-4 rounded-lg border-2 transition-all ${
                  splitMode === "equal"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    splitMode === "equal"
                      ? "border-blue-500"
                      : "border-zinc-400"
                  }`}>
                    {splitMode === "equal" && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Equal Split</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 text-left">
                  Divide remainder equally among selected participants
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode("proportional")}
                disabled={isSubmitting}
                className={`p-4 rounded-lg border-2 transition-all ${
                  splitMode === "proportional"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    splitMode === "proportional"
                      ? "border-blue-500"
                      : "border-zinc-400"
                  }`}>
                    {splitMode === "proportional" && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Proportional</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 text-left">
                  Distribute based on current share percentages
                </p>
              </button>
            </div>
          </div>

          {/* Participant Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Select Participants ({selectedUserIds.size} selected)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
              {availableUsers.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  disabled={isSubmitting}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedUserIds.has(user.id)
                      ? "bg-blue-500 border-blue-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}>
                    {selectedUserIds.has(user.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {user.user.displayName || user.user.email}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Current: {spend.currency} {user.shareAmount.toFixed(2)} ({(user.shareAmount / spend.amount * 100).toFixed(1)}%)
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Preview After Split
            </h3>
            <div className="space-y-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-blue-50/30 dark:bg-blue-900/10">
              {previewAssignments.map(assignment => {
                const isSelected = selectedUserIds.has(assignment.userId);
                const originalAssignment = existingAssignments.find(a => a.userId === assignment.userId);
                const change = assignment.shareAmount - (originalAssignment?.shareAmount || 0);

                return (
                  <div
                    key={assignment.userId}
                    className={`p-3 rounded-lg ${
                      isSelected
                        ? "bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800"
                        : "bg-zinc-50 dark:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {assignment.user.displayName || assignment.user.email}
                        </p>
                        {isSelected && change > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            +{spend.currency} {change.toFixed(2)} added
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {spend.currency} {assignment.shareAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {(assignment.shareAmount / spend.amount * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total Check */}
              <div className="pt-3 mt-2 border-t border-zinc-300 dark:border-zinc-600">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Total Assigned After Split:
                  </span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    {spend.currency} {previewAssignments.reduce((sum, a) => sum + a.shareAmount, 0).toFixed(2)} (100.0%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="tap-target flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || selectedUserIds.size === 0 || remainder <= 0}
              className="tap-target flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Applying..." : "Apply Split"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
