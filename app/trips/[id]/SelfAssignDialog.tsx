"use client";

import { useState, useEffect } from "react";
import { SplitType } from "@/lib/generated/prisma";

interface SelfAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (amount: number) => Promise<void>;
  spend: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    normalizedAmount: number;
  };
  trip: {
    baseCurrency: string;
  };
  currentUserId: string;
  existingAssignment?: {
    id: string;
    shareAmount: number;
    normalizedShareAmount: number;
  };
  assignedPercentage: number;
}

export default function SelfAssignDialog({
  isOpen,
  onClose,
  onAssign,
  spend,
  trip,
  currentUserId,
  existingAssignment,
  assignedPercentage,
}: SelfAssignDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with existing assignment amount if it exists
  useEffect(() => {
    if (existingAssignment) {
      setAmount(existingAssignment.shareAmount.toString());
    } else {
      setAmount("");
    }
    setError(null);
  }, [existingAssignment, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      ((existingAssignment?.shareAmount || 0) / spend.amount * 100) +
      newPercentage;

    if (totalPercentageWithThisChange > 100.1) { // Allow small rounding tolerance
      setError(`This would exceed 100% assignment (would be ${totalPercentageWithThisChange.toFixed(1)}%)`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssign(numAmount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign spend");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Calculate real-time percentage
  const currentAmount = parseFloat(amount) || 0;
  const currentPercentage = (currentAmount / spend.amount) * 100;
  const remainingPercentage = 100 - assignedPercentage +
    ((existingAssignment?.shareAmount || 0) / spend.amount * 100) -
    currentPercentage;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Assign to Yourself
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
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Total: {spend.currency} {spend.amount.toFixed(2)}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Your Share Amount
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
                  disabled={isSubmitting}
                  className="w-full pl-16 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            {/* Real-time Stats */}
            <div className="space-y-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Your percentage:
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {currentPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Currently assigned:
                </span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {assignedPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Remaining unassigned:
                </span>
                <span className={`text-sm font-bold ${
                  remainingPercentage < 0
                    ? "text-red-600 dark:text-red-400"
                    : remainingPercentage < 0.1
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}>
                  {remainingPercentage.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
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
                type="submit"
                disabled={isSubmitting || !amount || parseFloat(amount) < 0}
                className="tap-target flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Assigning..." : existingAssignment ? "Update" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
