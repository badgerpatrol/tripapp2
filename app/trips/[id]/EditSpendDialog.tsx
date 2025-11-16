"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface Spend {
  id: string;
  description: string;
  amount: number;
  currency: string;
  fxRate: number;
  normalizedAmount: number;
  date: string;
  status: string;
  notes: string | null;
  paidBy: {
    id: string;
    email: string;
    displayName: string | null;
  };
  category: {
    id: string;
    name: string;
  } | null;
  assignedPercentage?: number;
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

interface EditSpendDialogProps {
  spend: Spend | null;
  trip: {
    id: string;
    baseCurrency: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (spendId: string) => void;
  onManageItems?: () => void;
}

export default function EditSpendDialog({
  spend,
  trip,
  isOpen,
  onClose,
  onSuccess,
  onManageItems,
}: EditSpendDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "",
    fxRate: "",
    date: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate form when spend changes
  useEffect(() => {
    if (spend) {
      setFormData({
        description: spend.description,
        amount: spend.amount.toString(),
        currency: spend.currency,
        fxRate: spend.fxRate.toString(),
        date: new Date(spend.date).toISOString().split("T")[0], // YYYY-MM-DD format
        notes: spend.notes || "",
      });
    }
  }, [spend]);

  if (!isOpen || !spend) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to edit a spend");
      }

      // Validate amount
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Validate FX rate
      const fxRate = parseFloat(formData.fxRate);
      if (isNaN(fxRate) || fxRate <= 0) {
        throw new Error("FX rate must be a positive number");
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spend.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          description: formData.description,
          amount,
          currency: formData.currency,
          fxRate,
          date: new Date(formData.date),
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update spend");
      }

      onSuccess(spend.id);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Edit Spend
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

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description (What) */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                What did you spend on? *
              </label>
              <input
                type="text"
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                maxLength={500}
                placeholder="e.g., Hotel accommodation, Dinner, Taxi"
                className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Manage Items Button */}
            {onManageItems && (
              <div>
                <button
                  type="button"
                  onClick={onManageItems}
                  disabled={isSubmitting}
                  className="tap-target w-full px-4 py-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Manage Items
                </button>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Break down the spend into individual items
                </p>
              </div>
            )}

            {/* Amount and Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Amount *
                </label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="tap-target w-full max-w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="currency"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Currency *
                </label>
                <input
                  type="text"
                  id="currency"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value.toUpperCase() })
                  }
                  required
                  maxLength={3}
                  placeholder="USD"
                  className="tap-target w-full max-w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Trip currency: {trip.baseCurrency}
                </p>
              </div>
            </div>

            {/* FX Rate and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label
                  htmlFor="fxRate"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Exchange Rate
                </label>
                <input
                  type="number"
                  id="fxRate"
                  value={formData.fxRate}
                  onChange={(e) =>
                    setFormData({ ...formData, fxRate: e.target.value })
                  }
                  min="0.000001"
                  step="0.000001"
                  placeholder="1.0"
                  className="tap-target w-full max-w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Rate to convert to {trip.baseCurrency}
                </p>
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                  className="tap-target w-full max-w-[180px] min-w-0 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition box-border"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                maxLength={2000}
                rows={3}
                placeholder="Add any additional details..."
                className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse md:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving Changes..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
