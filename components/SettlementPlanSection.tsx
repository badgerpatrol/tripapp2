"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { PersonBalance } from "@/types/schemas";
import RecordPaymentDialog from "@/app/trips/[id]/RecordPaymentDialog";
import EditPaymentDialog from "@/app/trips/[id]/EditPaymentDialog";

interface SettlementPlanSectionProps {
  tripId: string;
  baseCurrency: string;
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
}: SettlementPlanSectionProps) {
  const { user } = useAuth();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [persistedSettlements, setPersistedSettlements] = useState<PersistedSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<PersistedSettlement | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [showEditPaymentDialog, setShowEditPaymentDialog] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [recordingPaymentId, setRecordingPaymentId] = useState<string | null>(null);
  const [perPersonTotalsCollapsed, setPerPersonTotalsCollapsed] = useState(true);

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

  // Get balances
  const getFilteredBalances = () => {
    if (!balanceData?.balances) return [];
    return balanceData.balances;
  };

  // Get settlements
  const getFilteredSettlements = () => {
    if (!balanceData?.settlements) return [];
    return balanceData.settlements;
  };

  const handleRecordPayment = (settlement: PersistedSettlement) => {
    setSelectedSettlement(settlement);
    setRecordingPaymentId(settlement.id);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentDialog(false);
    setSelectedSettlement(null);
    // Refetch data to update the UI
    await fetchData();
    setRecordingPaymentId(null);
  };

  const handleEditPayment = (payment: any, settlement: PersistedSettlement) => {
    setEditingPayment(payment);
    setSelectedSettlement(settlement);
    setShowEditPaymentDialog(true);
  };

  const handleEditPaymentSuccess = () => {
    setShowEditPaymentDialog(false);
    setEditingPayment(null);
    setSelectedSettlement(null);
    // Refetch data to update the UI
    fetchData();
  };

  const handleDeletePayment = async (paymentId: string, settlementId: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this payment? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingPaymentId(paymentId);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/settlements/${settlementId}/payments/${paymentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete payment");
      }

      // Refetch data to update the UI
      await fetchData();
    } catch (err) {
      console.error("Error deleting payment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-zinc-600 dark:text-zinc-400">Loading settlement plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!balanceData) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Settlement Plan with Payment Tracking */}
        <div>
          {getFilteredSettlements().length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <p className="text-green-600 dark:text-green-400 font-medium">
                {balanceData.totalSpent === 0 ? "Nothing to settle." : "All balanced!"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                {getFilteredSettlements().length}{" "}
                {getFilteredSettlements().length === 1 ? "transfer" : "transfers"} needed to
                settle all balances
              </p>
            <div className="space-y-3">
              {getFilteredSettlements().map((settlement, index) => {
                // Find matching persisted settlement for this calculated settlement
                const persistedSettlement = persistedSettlements.find(
                  (ps) =>
                    ps.fromUserId === settlement.fromUserId &&
                    ps.toUserId === settlement.toUserId
                );

                // Determine the color based on payment status
                const isFullyPaid = persistedSettlement && persistedSettlement.remainingAmount <= 0;
                const cardColor = persistedSettlement
                  ? isFullyPaid
                    ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  : "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800";

                return (
                  <div
                    key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}
                    className={`border rounded-lg p-3 sm:p-4 ${cardColor}`}
                  >
                    {/* Settlement Header */}
                    <div className="flex flex-col gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                          {settlement.fromUserName}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 flex-shrink-0">→</span>
                        <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                          {settlement.toUserName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 break-all">
                          {formatCurrency(settlement.amount)}
                        </span>
                        {persistedSettlement && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap">
                            {
                              persistedSettlement.remainingAmount === persistedSettlement.amount
                                ? "Unpaid"
                                : persistedSettlement.remainingAmount > 0
                                ? "Partial"
                                : "Paid"
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Details (if persisted settlement exists) */}
                    {persistedSettlement ? (
                      <>
                        {/* Amount Breakdown */}
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-300 dark:border-zinc-600">
                          <div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Total</p>
                            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                              {formatCurrency(persistedSettlement.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Paid</p>
                            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                              {formatCurrency(persistedSettlement.totalPaid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">Remain</p>
                            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-all">
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
                            <div className="space-y-3">
                              {persistedSettlement.payments.map((payment) => (
                                <div
                                  key={payment.id}
                                  className="text-sm text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-600 overflow-hidden"
                                >
                                  <div className="p-3">
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                                      {formatCurrency(payment.amount)}
                                    </div>
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                      {new Date(payment.paidAt).toLocaleDateString()}
                                      {payment.paymentMethod && ` • ${payment.paymentMethod}`}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                      Recorded by {payment.recordedByName}
                                    </div>
                                  </div>
                                  <div className="flex border-t border-zinc-200 dark:border-zinc-600">
                                    <button
                                      onClick={() => handleEditPayment(payment, persistedSettlement)}
                                      disabled={deletingPaymentId === payment.id}
                                      className="tap-target flex-1 flex items-center justify-center gap-1 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium transition-colors text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePayment(payment.id, persistedSettlement.id)}
                                      disabled={deletingPaymentId === payment.id}
                                      className="tap-target flex-1 flex items-center justify-center gap-1 py-2 sm:py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 font-medium border-l border-zinc-200 dark:border-zinc-600 transition-colors text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed relative"
                                    >
                                      {deletingPaymentId === payment.id ? (
                                        <span className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                      ) : (
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      )}
                                      {deletingPaymentId === payment.id ? "Deleting..." : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Record Payment Button */}
                        {persistedSettlement.remainingAmount > 0 && (
                          <button
                            onClick={() => handleRecordPayment(persistedSettlement)}
                            disabled={recordingPaymentId === persistedSettlement.id || deletingPaymentId !== null}
                            className="w-full mt-3 px-3 py-2 bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {recordingPaymentId === persistedSettlement.id ? (
                              <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Opening...
                              </>
                            ) : (
                              "Record Payment"
                            )}
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
            </>
          )}
        </div>

        {/* Per-Person Balances */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Per-Person Totals
            </h3>
            <button
              onClick={() => setPerPersonTotalsCollapsed(!perPersonTotalsCollapsed)}
              className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors flex-shrink-0"
              aria-label={perPersonTotalsCollapsed ? "Expand Per-Person Totals" : "Collapse Per-Person Totals"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {perPersonTotalsCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>
          </div>
          {!perPersonTotalsCollapsed && (
            <div className="space-y-3">
            {getFilteredBalances()
              .sort((a, b) => b.netBalance - a.netBalance) // Owed money first
              .map((balance) => (
                <div
                  key={balance.userId}
                  className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 sm:p-4 border border-zinc-200 dark:border-zinc-600"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      {balance.userPhotoURL && (
                        <img
                          src={balance.userPhotoURL}
                          alt={balance.userName}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {balance.userName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm sm:text-base font-bold break-all ${
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
                      <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 break-all">
                        {formatCurrency(balance.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Owes</p>
                      <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 break-all">
                        {formatCurrency(balance.totalOwed)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        settlement={selectedSettlement}
        baseCurrency={baseCurrency}
        isOpen={showPaymentDialog}
        onClose={() => {
          setShowPaymentDialog(false);
          setRecordingPaymentId(null);
        }}
        onSuccess={handlePaymentSuccess}
      />

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        payment={editingPayment}
        settlement={selectedSettlement}
        baseCurrency={baseCurrency}
        isOpen={showEditPaymentDialog}
        onClose={() => setShowEditPaymentDialog(false)}
        onSuccess={handleEditPaymentSuccess}
      />
    </>
  );
}
