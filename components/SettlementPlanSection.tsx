"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { PersonBalance } from "@/types/schemas";
import RecordPaymentDialog from "@/app/trips/[id]/RecordPaymentDialog";

interface SettlementPlanSectionProps {
  tripId: string;
  baseCurrency: string;
  onToggleSpends: () => void;
  onReopenSpending?: () => void;
  canReopenSpending?: boolean;
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

export default function SettlementPlanSection({
  tripId,
  baseCurrency,
  onToggleSpends,
  onReopenSpending,
  canReopenSpending = false,
}: SettlementPlanSectionProps) {
  const { user } = useAuth();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [persistedSettlements, setPersistedSettlements] = useState<PersistedSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<PersistedSettlement | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const fetchData = async () => {
    if (!user) return;

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

  useEffect(() => {
    fetchData();
  }, [user, tripId]);

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
    fetchData();
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
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
      {/* Header with Reopen Spending and View Spends buttons */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Settlement Plan</h2>
          <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Spending Closed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSpends}
            className="tap-target px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Spends
          </button>
          {canReopenSpending && onReopenSpending && (
            <button
              onClick={onReopenSpending}
              className="tap-target px-4 py-2 rounded-lg font-medium transition-colors bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
            >
              Reopen Spending
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="text-zinc-600 dark:text-zinc-400">Loading settlement plan...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && balanceData && (
        <div className="space-y-6">
          {/* Total Spent Summary */}
          

          {/* Settlement Plan with Payment Tracking */}
          <div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {balanceData.settlements.length > 0
                ? `${balanceData.settlements.length} ${
                    balanceData.settlements.length === 1 ? "transfer" : "transfers"
                  } needed to settle all balances`
                : "All balanced!"}
            </p>

            {balanceData.settlements.length === 0 ? (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                <p className="text-green-600 dark:text-green-400 font-medium">
                  All balanced! No settlements needed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {balanceData.settlements.map((settlement, index) => {
                  // Find matching persisted settlement for this calculated settlement
                  const persistedSettlement = persistedSettlements.find(
                    (ps) =>
                      ps.fromUserId === settlement.fromUserId &&
                      ps.toUserId === settlement.toUserId
                  );

                  return (
                    <div
                      key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}
                      className={
                        persistedSettlement
                          ? `border rounded-lg p-4 ${getStatusColor(persistedSettlement.status)}`
                          : "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                      }
                    >
                      {/* Settlement Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {settlement.fromUserName}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-300">→</span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {settlement.toUserName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {persistedSettlement && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold border">
                              {persistedSettlement.status}
                            </span>
                          )}
                          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                            {formatCurrency(settlement.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Payment Details (if persisted settlement exists) */}
                      {persistedSettlement ? (
                        <>
                          {/* Amount Breakdown */}
                          <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-zinc-300 dark:border-zinc-600">
                            <div>
                              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Total</p>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(persistedSettlement.amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Paid</p>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(persistedSettlement.totalPaid)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Remaining</p>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(persistedSettlement.remainingAmount)}
                              </p>
                            </div>
                          </div>

                          {/* Payment History */}
                          {persistedSettlement.payments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-300 dark:border-zinc-600">
                              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                                Payment History ({persistedSettlement.payments.length})
                              </p>
                              <div className="space-y-1">
                                {persistedSettlement.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="text-xs text-zinc-700 dark:text-zinc-300 flex justify-between"
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

                          {/* Record Payment Button */}
                          {persistedSettlement.remainingAmount > 0.01 && (
                            <button
                              onClick={() => handleRecordPayment(persistedSettlement)}
                              className="w-full mt-3 px-4 py-2 bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                              Record Payment
                            </button>
                          )}
                        </>
                      ) : (
                        /* Show debt age for non-persisted settlements */
                        settlement.oldestDebtDate && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                            {getDebtAge(settlement.oldestDebtDate)}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
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
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {balance.userEmail}
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
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Paid</p>
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {formatCurrency(balance.totalPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Owes</p>
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {formatCurrency(balance.totalOwed)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

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
