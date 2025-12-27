"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  recordedByName: string;
  createdAt: string;
}

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

interface EditPaymentDialogProps {
  payment: Payment | null;
  settlement: Settlement | null;
  baseCurrency: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPaymentDialog({
  payment,
  settlement,
  baseCurrency,
  isOpen,
  onClose,
  onSuccess,
}: EditPaymentDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    amount: "",
    paidAt: "",
    paymentMethod: "",
    paymentReference: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when payment changes
  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount.toString(),
        paidAt: new Date(payment.paidAt).toISOString().split("T")[0],
        paymentMethod: payment.paymentMethod || "",
        paymentReference: payment.paymentReference || "",
        notes: payment.notes || "",
      });
    }
  }, [payment]);

  if (!isOpen || !payment || !settlement) return null;

  const formatCurrency = (amount: number) => {
    return `${baseCurrency} ${amount.toFixed(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to edit a payment");
      }

      // Validate amount
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Calculate what the remaining amount would be if this payment is edited
      const currentPaymentAmount = payment.amount;
      const remainingAmount = settlement.remainingAmount ?? 0;
      const maxAllowedAmount = remainingAmount + currentPaymentAmount;

      // Check with small tolerance for floating point precision
      if (amount > maxAllowedAmount + 0.001) {
        throw new Error(`Payment amount cannot exceed ${formatCurrency(maxAllowedAmount)}`);
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/settlements/${settlement.id}/payments/${payment.id}`, {
        method: "PATCH",
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
        throw new Error(errorData.error || "Failed to update payment");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating payment:", err);
      setError(err instanceof Error ? err.message : "Failed to update payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Payment</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Settlement Info */}
          <div className="mb-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Settlement</div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100">
              {settlement.fromUserName} → {settlement.toUserName}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Total: {formatCurrency(settlement.amount)}
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Payment Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.paidAt}
              onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })}
              className="w-full min-w-0 appearance-none px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
              required
            />
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes about this payment"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              variant="secondary"
              full
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              loading={isSubmitting}
              variant="primary"
              full
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
