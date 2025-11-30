"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { PersonBalance, SettlementTransfer } from "@/types/schemas";
import RecordPaymentDialog from "./RecordPaymentDialog";

interface BalancesDialogProps {
  tripId: string;
  baseCurrency: string;
  isOpen: boolean;
  onClose: () => void;
}

interface BalanceData {
  tripId: string;
  baseCurrency: string;
  totalSpent: number;
  balances: PersonBalance[];
  settlements: Array<{
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
    oldestDebtDate: string | null;
  }>;
  calculatedAt: string;
}

interface PersistedSettlement {
  id: string;
  tripId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  status: string;
  totalPaid: number;
  remainingAmount: number;
  createdAt: string;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    notes: string | null;
    recordedByName: string;
    createdAt: string;
  }>;
}

export default function BalancesDialog({
  tripId,
  baseCurrency,
  isOpen,
  onClose,
}: BalancesDialogProps) {
  const { user } = useAuth();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [persistedSettlements, setPersistedSettlements] = useState<PersistedSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<PersistedSettlement | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !user) return;

      setLoading(true);
      setError(null);

      try {
        const idToken = await user.getIdToken();

        // Fetch calculated balances and persisted settlements in parallel
        const [balancesResponse, settlementsResponse] = await Promise.all([
          fetch(`/api/trips/${tripId}/balances`, {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(`/api/trips/${tripId}/settlements`, {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
        ]);

        if (!balancesResponse.ok) {
          const errorData = await balancesResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to fetch balances");
        }

        const balancesData = await balancesResponse.json();
        setBalanceData(balancesData.balances);

        // Persisted settlements are optional (may not exist yet)
        if (settlementsResponse.ok) {
          const settlementsData = await settlementsResponse.json();
          setPersistedSettlements(settlementsData.settlements || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to load balances");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, user, tripId]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return `${baseCurrency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getDebtAge = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `Debt since ${formatDate(dateString)} (${date.toLocaleDateString()})`;
  };

  const handleRecordPayment = (settlement: PersistedSettlement) => {
    setSelectedSettlement(settlement);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    setSelectedSettlement(null);
    // Refetch data to update the UI
    if (user) {
      const fetchData = async () => {
        try {
          const idToken = await user.getIdToken();
          const [balancesResponse, settlementsResponse] = await Promise.all([
            fetch(`/api/trips/${tripId}/balances`, {
              headers: { Authorization: `Bearer ${idToken}` },
            }),
            fetch(`/api/trips/${tripId}/settlements`, {
              headers: { Authorization: `Bearer ${idToken}` },
            }),
          ]);

          if (balancesResponse.ok) {
            const balancesData = await balancesResponse.json();
            setBalanceData(balancesData.balances);
          }

          if (settlementsResponse.ok) {
            const settlementsData = await settlementsResponse.json();
            setPersistedSettlements(settlementsData.settlements || []);
          }
        } catch (err) {
          console.error("Error refreshing data:", err);
        }
      };
      fetchData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      case "PARTIALLY_PAID":
        return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "PAID":
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "VERIFIED":
        return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800";
      default:
        return "text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Trip Balances & Settlement Plan
          </h2>
          <button
            onClick={onClose}
            className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-zinc-600 dark:text-zinc-400">Loading balances...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && balanceData && (
            <div className="space-y-8">
              {/* Total Spent Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                  Total Trip Spending
                </p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(balanceData.totalSpent)}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-2">
                  Calculated {formatDate(balanceData.calculatedAt)}
                </p>
              </div>
              {/* Settlement Plan */}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Settlement Plan
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  {balanceData.settlements.length > 0 &&
                    ` ${balanceData.settlements.length} ${
                      balanceData.settlements.length === 1 ? "transfer" : "transfers"
                    } needed`}
                </p>

                {balanceData.settlements.length === 0 ? (
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      All balanced! No settlements needed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {balanceData.settlements.map((settlement, index) => (
                      <div
                        key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}
                        className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {settlement.fromUserName}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">→</span>
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {settlement.toUserName}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                            {formatCurrency(settlement.amount)}
                          </span>
                        </div>
                        {settlement.oldestDebtDate && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {getDebtAge(settlement.oldestDebtDate)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Per-Person Balances */}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Per-Person Totals
                </h3>
                <div className="space-y-3">
                  {balanceData.balances
                    .sort((a, b) => b.netBalance - a.netBalance) // Owed money first
                    .map((balance) => (
                      <div
                        key={balance.userId}
                        className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {balance.userPhotoURL && (
                              <img
                                src={balance.userPhotoURL}
                                alt={balance.userName}
                                className="w-10 h-10 rounded-full"
                              />
                            )}
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {balance.userName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-lg font-bold ${
                                balance.netBalance > 0.01
                                  ? "text-green-600 dark:text-green-400"
                                  : balance.netBalance < -0.01
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              {balance.netBalance > 0.01
                                ? `+${formatCurrency(balance.netBalance)}`
                                : balance.netBalance < -0.01
                                ? formatCurrency(balance.netBalance)
                                : "Settled"}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {balance.netBalance > 0.01
                                ? "Is owed"
                                : balance.netBalance < -0.01
                                ? "Owes"
                                : "Even"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                          <div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Paid</p>
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 break-all">
                              {formatCurrency(balance.totalPaid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Owes</p>
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 break-all">
                              {formatCurrency(balance.totalOwed)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Persisted Settlements (Payments) */}
              {persistedSettlements.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Payment Tracking
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    Record and track payments towards settlements
                  </p>

                  <div className="space-y-4">
                    {persistedSettlements.map((settlement) => (
                      <div
                        key={settlement.id}
                        className={`border rounded-lg p-4 ${getStatusColor(settlement.status)}`}
                      >
                        {/* Settlement Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {settlement.fromUserName}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">→</span>
                            <span className="font-semibold">
                              {settlement.toUserName}
                            </span>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-medium border">
                            {settlement.status}
                          </span>
                        </div>

                        {/* Amount Details */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div>
                            <p className="text-xs opacity-70">Total</p>
                            <p className="text-sm font-bold break-all">{formatCurrency(settlement.amount)}</p>
                          </div>
                          <div>
                            <p className="text-xs opacity-70">Paid</p>
                            <p className="text-sm font-bold break-all">{formatCurrency(settlement.totalPaid)}</p>
                          </div>
                          <div>
                            <p className="text-xs opacity-70">Remaining</p>
                            <p className="text-sm font-bold break-all">{formatCurrency(settlement.remainingAmount)}</p>
                          </div>
                        </div>

                        {/* Payment History */}
                        {settlement.payments.length > 0 && (
                          <div className="mb-3 pt-3 border-t border-current opacity-20">
                            <p className="text-xs font-medium mb-2 opacity-100">
                              Payment History ({settlement.payments.length})
                            </p>
                            <div className="space-y-2">
                              {settlement.payments.map((payment) => (
                                <div
                                  key={payment.id}
                                  className="text-xs opacity-70 flex justify-between"
                                >
                                  <span>
                                    {formatCurrency(payment.amount)} on{" "}
                                    {new Date(payment.paidAt).toLocaleDateString()}
                                    {payment.paymentMethod && ` via ${payment.paymentMethod}`}
                                  </span>
                                  <span>by {payment.recordedByName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Record Payment Button THRESHOLD */}
                        {settlement.remainingAmount > 0 && (
                          <button
                            onClick={() => handleRecordPayment(settlement)}
                            className="w-full mt-2 px-4 py-2 bg-white dark:bg-zinc-800 border-2 border-current rounded-lg font-medium hover:bg-opacity-90 transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
          <button
            onClick={onClose}
            className="tap-target bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        settlement={selectedSettlement}
        baseCurrency={baseCurrency}
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
