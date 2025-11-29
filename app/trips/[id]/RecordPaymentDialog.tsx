"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

interface Settlement {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  status: string;
  totalPaid?: number;
  remainingAmount?: number;
}

interface RecordPaymentDialogProps {
  settlement: Settlement | null;
  baseCurrency: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordPaymentDialog({
  settlement,
  baseCurrency,
  isOpen,
  onClose,
  onSuccess,
}: RecordPaymentDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    amount: "",
    paidAt: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
    paymentMethod: "",
    paymentReference: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !settlement) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to record a payment");
      }

      // Validate amount
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Check if amount exceeds remaining (with small tolerance for floating point precision)
      const remainingAmount = settlement.remainingAmount ?? settlement.amount;
      if (amount > remainingAmount + 0.001) {
        throw new Error(`Payment amount cannot exceed remaining amount of ${formatCurrency(remainingAmount)}`);
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/settlements/${settlement.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount,
          paidAt: new Date(formData.paidAt),
          paymentMethod: formData.paymentMethod || undefined,
          paymentReference: formData.paymentReference || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to record payment");
      }

      // Reset form
      setFormData({
        amount: "",
        paidAt: new Date().toISOString().split("T")[0],
        paymentMethod: "",
        paymentReference: "",
        notes: "",
      });

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

  const handlePayFull = () => {
    const remainingAmount = settlement.remainingAmount ?? settlement.amount;
    setFormData({ ...formData, amount: remainingAmount.toFixed(2) });
  };

  const formatCurrency = (amount: number) => {
    return `${baseCurrency} ${amount.toFixed(2)}`;
  };

  const remainingAmount = settlement.remainingAmount ?? settlement.amount;
  const totalPaid = settlement.totalPaid ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Record Payment
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

          {/* Settlement Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
              <span className="font-semibold">{settlement.fromUserName}</span> owes{" "}
              <span className="font-semibold">{settlement.toUserName}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-blue-700 dark:text-blue-300 text-xs">Total Amount:</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100 break-all">
                  {formatCurrency(settlement.amount)}
                </p>
              </div>
              {totalPaid > 0 && (
                <div>
                  <p className="text-blue-700 dark:text-blue-300 text-xs">Already Paid:</p>
                  <p className="font-semibold text-blue-900 dark:text-blue-100 break-all">
                    {formatCurrency(totalPaid)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-blue-700 dark:text-blue-300 text-xs">Remaining:</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100 break-all">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
              <div>
                <p className="text-blue-700 dark:text-blue-300 text-xs">Status:</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100 truncate">
                  {settlement.status}
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Payment Amount ({baseCurrency}) *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  min="0.01"
                  max={Math.ceil(remainingAmount * 100) / 100}
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="0.00"
                />
                <Button
                  type="button"
                  onClick={handlePayFull}
                  disabled={isSubmitting}
                  variant="primary"
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 whitespace-nowrap"
                >
                  Pay Full
                </Button>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Maximum: {formatCurrency(remainingAmount)}
              </p>
            </div>

            {/* Payment Date */}
            <div>
              <label
                htmlFor="paidAt"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Payment Date *
              </label>
              <input
                type="date"
                id="paidAt"
                value={formData.paidAt}
                onChange={(e) =>
                  setFormData({ ...formData, paidAt: e.target.value })
                }
                required
                disabled={isSubmitting}
                className="w-full min-w-0 appearance-none px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 box-border"
              />
            </div>

            

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                disabled={isSubmitting}
                rows={3}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                placeholder="Any additional notes about this payment..."
                maxLength={2000}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                variant="outline"
                full
                size="lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                loading={isSubmitting}
                variant="primary"
                full
                size="lg"
              >
                {isSubmitting ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
