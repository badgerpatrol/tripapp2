"use client";

import { useState, useEffect } from "react";

interface EditAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (amount: number) => Promise<void>;
  onRemove: () => Promise<void>;
  assignment: {
    id: string;
    userId: string;
    shareAmount: number;
    normalizedShareAmount: number;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  };
  spend: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    normalizedAmount: number;
    paidBy: {
      id: string;
    };
  };
  currentUserId: string;
  assignedPercentage: number;
}

export default function EditAssignmentDialog({
  isOpen,
  onClose,
  onUpdate,
  onRemove,
  assignment,
  spend,
  currentUserId,
  assignedPercentage,
}: EditAssignmentDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine permissions
  const isSpender = spend.paidBy.id === currentUserId;
  const isAssignmentOwner = assignment.userId === currentUserId;
  const canEdit = isSpender || isAssignmentOwner;
  const canRemove = isSpender || isAssignmentOwner;

  // Initialize with existing assignment amount
  useEffect(() => {
    if (isOpen) {
      setAmount(assignment.shareAmount.toString());
      setError(null);
      setShowRemoveConfirm(false);
    }
  }, [assignment.shareAmount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canEdit) {
      setError("You do not have permission to edit this assignment");
      return;
    }

    const numAmount = parseFloat(amount);

    // Validation
    if (isNaN(numAmount) || numAmount < 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (numAmount > spend.amount) {
      setError(`Amount cannot exceed spend total (${spend.currency} ${spend.amount.toFixed(2)})`);
      return;
    }

    // Calculate what percentage this would create
    const newPercentage = (numAmount / spend.amount) * 100;
    const totalPercentageWithThisChange = assignedPercentage -
      ((assignment.shareAmount || 0) / spend.amount * 100) +
      newPercentage;

    // Show warning but don't block if >100%
    if (totalPercentageWithThisChange > 100.1) {
      setError(`Warning: This would result in ${totalPercentageWithThisChange.toFixed(1)}% total assignment (exceeds 100%)`);
      // Don't return, allow the update
    }

    setIsSubmitting(true);
    try {
      await onUpdate(numAmount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveClick = () => {
    if (!canRemove) {
      setError("You do not have permission to remove this user");
      return;
    }
    setShowRemoveConfirm(true);
  };

  const handleRemoveConfirm = async () => {
    setError(null);
    setIsRemoving(true);
    try {
      await onRemove();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove assignment");
      setShowRemoveConfirm(false);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isRemoving) {
      onClose();
    }
  };

  const handleAddRemaining = () => {
    const newAmount = currentAmount + remainingUnassignedAmount;
    setAmount(newAmount.toFixed(2));
  };

  // Calculate real-time percentage
  const currentAmount = parseFloat(amount) || 0;
  const currentPercentage = (currentAmount / spend.amount) * 100;
  const remainingPercentage = 100 - assignedPercentage +
    ((assignment.shareAmount || 0) / spend.amount * 100) -
    currentPercentage;

  const totalAfterChange = assignedPercentage - ((assignment.shareAmount || 0) / spend.amount * 100) + currentPercentage;

  // Calculate amounts
  const totalAssignedAmount = (totalAfterChange / 100) * spend.amount;
  const remainingUnassignedAmount= spend.amount-totalAssignedAmount

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Edit Assignment
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting || isRemoving}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info */}
          <div className="mb-6 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              User
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {(assignment.user.displayName || assignment.user.email)[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {assignment.user.displayName || assignment.user.email}
                </p>
                {assignment.user.displayName && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{assignment.user.email}</p>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Spend: <span className="font-medium text-zinc-900 dark:text-zinc-100">{spend.description}</span>
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Total: {spend.currency} {spend.amount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Remove Confirmation */}
          {showRemoveConfirm ? (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-3">
                Are you sure you want to remove {assignment.user.displayName || assignment.user.email} from this spend?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isRemoving}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveConfirm}
                  disabled={isRemoving}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isRemoving ? "Removing..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Assignment Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                        {spend.currency}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={spend.amount}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting || !canEdit}
                      className="w-full pl-16 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Add Remaining Button */}
                {remainingUnassignedAmount > 0.01 && canEdit && (
                  <button
                    type="button"
                    onClick={handleAddRemaining}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Remaining {spend.currency} {remainingUnassignedAmount.toFixed(2)}
                  </button>
                )}

                {/* Real-time Stats */}
                <div className="space-y-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      % of total:
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {currentPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Total assigned:
                    </span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${
                        totalAfterChange > 100
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}>
                        {spend.currency} {totalAssignedAmount.toFixed(2)}
                      </span>
                      <span className={`text-xs ml-1 ${
                        totalAfterChange > 100
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}>
                        ({totalAfterChange.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Remaining unassigned:
                    </span>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        remainingPercentage < 0
                          ? "text-red-600 dark:text-red-400"
                          : remainingPercentage < 0.1
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {spend.currency} {remainingUnassignedAmount.toFixed(2)}
                      </span>
                      <span className={`text-xs ml-1 ${
                        remainingPercentage < 0
                          ? "text-red-600 dark:text-red-400"
                          : remainingPercentage < 0.1
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        ({remainingPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className={`p-3 rounded-lg border ${
                    error.includes("Warning")
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}>
                    <p className={`text-sm ${
                      error.includes("Warning")
                        ? "text-yellow-900 dark:text-yellow-100"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="tap-target flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !amount || parseFloat(amount) < 0 || !canEdit}
                      className="tap-target flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Updating..." : "Update Amount"}
                    </button>
                  </div>

                  {/* Remove Button */}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={handleRemoveClick}
                      disabled={isSubmitting}
                      className="tap-target w-full px-4 py-3 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove from Spend
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
