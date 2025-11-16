"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import ManageItemsDialog from "./ManageItemsDialog";

interface SpendItem {
  id: string; // temporary ID for in-memory items
  name: string;
  description?: string;
  cost: number;
  userId?: string;
}

interface AddSpendDialogProps {
  trip: {
    id: string;
    baseCurrency: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (spendId: string) => void;
  onSuccessWithAddPeople?: (spendId: string) => void;
}

export default function AddSpendDialog({
  trip,
  isOpen,
  onClose,
  onSuccess,
  onSuccessWithAddPeople,
}: AddSpendDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: trip.baseCurrency,
    fxRate: "1.0",
    date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SpendItem[]>([]);
  const [isManageItemsOpen, setIsManageItemsOpen] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  // Calculate total from items
  const itemsTotal = items.reduce((sum, item) => sum + item.cost, 0);

  // Update amount field when items change
  useEffect(() => {
    if (items.length > 0) {
      setFormData((prev) => ({
        ...prev,
        amount: itemsTotal.toFixed(2),
      }));
    }
  }, [items, itemsTotal]);

  const handleManageItemsClose = (updatedItems: SpendItem[], capturedReceiptImage?: string) => {
    setItems(updatedItems);
    if (capturedReceiptImage) {
      setReceiptImage(capturedReceiptImage);
    }
    setIsManageItemsOpen(false);
  };

  // Reset form and items when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        description: "",
        amount: "",
        currency: trip.baseCurrency,
        fxRate: "1.0",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setItems([]);
      setReceiptImage(null);
      setError(null);
    }
  }, [isOpen, trip.baseCurrency]);

  if (!isOpen) return null;

  const saveSpend = async (): Promise<string> => {
    if (!user) {
      throw new Error("You must be logged in to add a spend");
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
    const response = await fetch("/api/spends", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        tripId: trip.id,
        description: formData.description,
        amount,
        currency: formData.currency,
        fxRate,
        date: new Date(formData.date),
        notes: formData.notes || undefined,
        receiptImageData: receiptImage || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to create spend");
    }

    const data = await response.json();
    return data.spend.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Save the spend first
      const spendId = await saveSpend();

      // If there are items, create them
      if (items.length > 0 && user) {
        const idToken = await user.getIdToken();

        for (const item of items) {
          const itemResponse = await fetch(`/api/spends/${spendId}/items`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              name: item.name,
              description: item.description || undefined,
              cost: item.cost,
              userId: item.userId || undefined,
            }),
          });

          if (!itemResponse.ok) {
            const errorData = await itemResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to create item");
          }
        }
      }

      // Reset form
      setFormData({
        description: "",
        amount: "",
        currency: trip.baseCurrency,
        fxRate: "1.0",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setItems([]);
      setReceiptImage(null);

      // Call success handler and close
      onSuccess(spendId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAndAddPeople = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Save the spend first
      const spendId = await saveSpend();

      // If there are items, create them
      if (items.length > 0 && user) {
        const idToken = await user.getIdToken();

        for (const item of items) {
          const itemResponse = await fetch(`/api/spends/${spendId}/items`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              name: item.name,
              description: item.description || undefined,
              cost: item.cost,
              userId: item.userId || undefined,
            }),
          });

          if (!itemResponse.ok) {
            const errorData = await itemResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to create item");
          }
        }
      }

      // Reset form
      setFormData({
        description: "",
        amount: "",
        currency: trip.baseCurrency,
        fxRate: "1.0",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setItems([]);
      setReceiptImage(null);

      // Close this dialog
      onClose();

      // Call the callback to open assign dialog with the new spend
      if (onSuccessWithAddPeople) {
        onSuccessWithAddPeople(spendId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setItems([]);
      setReceiptImage(null);
      // Reset form
      setFormData({
        description: "",
        amount: "",
        currency: trip.baseCurrency,
        fxRate: "1.0",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Add Manual Spend
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

            {/* Add Items Button */}
            <div>
              <button
                type="button"
                onClick={() => setIsManageItemsOpen(true)}
                disabled={isSubmitting || !formData.description}
                className="tap-target w-full px-4 py-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {items.length > 0 ? `Manage Items (${items.length})` : "Add Items"}
              </button>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {items.length > 0
                  ? `${items.length} item${items.length !== 1 ? "s" : ""} totaling ${formData.currency} ${itemsTotal.toFixed(2)}`
                  : "Optional: Break down the spend into individual items"}
              </p>
            </div>

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
                  readOnly={items.length > 0}
                  className={`tap-target w-full max-w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                    items.length > 0
                      ? "bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed"
                      : "bg-white dark:bg-zinc-800"
                  }`}
                />
                {items.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Amount calculated from {items.length} item{items.length !== 1 ? "s" : ""}
                  </p>
                )}
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
                  placeholder="GBP"
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
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex flex-col-reverse md:flex-row gap-3">
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
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isSubmitting ? "Adding Spend..." : "Save"}
                </button>
              </div>
              
            </div>
          </form>
        </div>
      </div>

      {/* Manage Items Dialog */}
      <ManageItemsDialog
        items={items}
        currency={formData.currency}
        tripId={trip.id}
        isOpen={isManageItemsOpen}
        onClose={handleManageItemsClose}
      />
    </div>
  );
}
