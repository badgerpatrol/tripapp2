"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface SpendItem {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  assignedUserId: string | null;
}

interface EditItemAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (selectedItemIds: string[]) => Promise<void>;
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

export default function EditItemAssignmentDialog({
  isOpen,
  onClose,
  onUpdate,
  onRemove,
  assignment,
  spend,
  currentUserId,
  assignedPercentage,
}: EditItemAssignmentDialogProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SpendItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine permissions
  const isSpender = spend.paidBy.id === currentUserId;
  const isAssignmentOwner = assignment.userId === currentUserId;
  const canEdit = isSpender || isAssignmentOwner;
  const canRemove = isSpender || isAssignmentOwner;

  // Fetch items when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      fetchItems();
    }
  }, [isOpen, spend.id, user]);

  // Initialize selected items based on current assignment
  useEffect(() => {
    if (isOpen && items.length > 0) {
      // Find items that are currently assigned to this user
      const userItems = items.filter(item => item.assignedUserId === assignment.userId);
      setSelectedItemIds(new Set(userItems.map(item => item.id)));
      setError(null);
      setShowRemoveConfirm(false);
    }
  }, [isOpen, items, assignment.userId]);

  const fetchItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spend.id}/items`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      } else {
        setError("Failed to load items");
      }
    } catch (err) {
      console.error("Error fetching items:", err);
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleItemToggle = (itemId: string) => {
    if (!canEdit) return;

    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canEdit) {
      setError("You do not have permission to edit this assignment");
      return;
    }

    const selectedIds = Array.from(selectedItemIds);
    const totalAmount = items
      .filter(item => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + item.cost, 0);

    // Validation
    if (totalAmount > spend.amount) {
      setError(`Selected items total (${spend.currency} ${totalAmount.toFixed(2)}) exceeds spend total`);
      return;
    }

    // Calculate what percentage this would create
    const newPercentage = (totalAmount / spend.amount) * 100;
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
      await onUpdate(selectedIds);
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

  // Calculate real-time totals
  const selectedItems = items.filter(item => selectedItemIds.has(item.id));
  const currentAmount = selectedItems.reduce((sum, item) => sum + item.cost, 0);
  const currentPercentage = (currentAmount / spend.amount) * 100;
  const totalAfterChange = assignedPercentage - ((assignment.shareAmount || 0) / spend.amount * 100) + currentPercentage;
  const remainingPercentage = 100 - totalAfterChange;
  const totalAssignedAmount = (totalAfterChange / 100) * spend.amount;
  const remainingUnassignedAmount = spend.amount - totalAssignedAmount;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Assign Items
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
                {/* Items Selection */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Select Items ({selectedItems.length} selected)
                  </label>

                  {loading ? (
                    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                      Loading items...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                      No items available for this spend
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {items.map((item) => {
                        const isSelected = selectedItemIds.has(item.id);
                        const isAssignedToOther = item.assignedUserId && item.assignedUserId !== assignment.userId;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                                : isAssignedToOther
                                ? "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-600 opacity-60"
                                : "bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                onClick={() => !isAssignedToOther && handleItemToggle(item.id)}
                                className={`flex-shrink-0 mt-0.5 ${
                                  canEdit && !isAssignedToOther ? "cursor-pointer" : "cursor-not-allowed"
                                }`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-600"
                                    : isAssignedToOther
                                    ? "bg-zinc-300 border-zinc-400 dark:bg-zinc-700 dark:border-zinc-600"
                                    : "border-zinc-300 dark:border-zinc-600"
                                }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {isAssignedToOther && (
                                    <svg className="w-3 h-3 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <div
                                onClick={() => !isAssignedToOther && handleItemToggle(item.id)}
                                className={`flex-1 min-w-0 ${
                                  canEdit && !isAssignedToOther ? "cursor-pointer" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${
                                      isSelected
                                        ? "text-blue-900 dark:text-blue-100"
                                        : "text-zinc-900 dark:text-zinc-100"
                                    }`}>
                                      {item.name}
                                    </p>
                                    {item.description && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                                        {item.description}
                                      </p>
                                    )}
                                    {isAssignedToOther && (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                        Already assigned to another user
                                      </p>
                                    )}
                                  </div>
                                  <span className={`text-sm font-semibold flex-shrink-0 ${
                                    isSelected
                                      ? "text-blue-900 dark:text-blue-100"
                                      : "text-zinc-900 dark:text-zinc-100"
                                  }`}>
                                    {spend.currency} {item.cost.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Real-time Stats */}
                <div className="space-y-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Selected items total:
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {spend.currency} {currentAmount.toFixed(2)}
                      </span>
                      <span className="text-xs ml-1 text-blue-600 dark:text-blue-400">
                        ({currentPercentage.toFixed(1)}%)
                      </span>
                    </div>
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
                      disabled={isSubmitting || !canEdit || loading}
                      className="tap-target flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Updating..." : "Update Assignment"}
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
                      Remove me from this spend
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
