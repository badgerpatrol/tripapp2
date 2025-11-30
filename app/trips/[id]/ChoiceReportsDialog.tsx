"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface ChoiceReportsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  choiceId: string | null;
  choiceName: string;
  tripId: string;
  choiceStatus: string;
  onOpenSpend: (spendId: string) => void;
}

export default function ChoiceReportsDialog({
  isOpen,
  onClose,
  choiceId,
  choiceName,
  tripId,
  choiceStatus,
  onOpenSpend,
}: ChoiceReportsDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "users" | "respondents">("items");
  const [itemsReport, setItemsReport] = useState<any>(null);
  const [usersReport, setUsersReport] = useState<any>(null);
  const [respondents, setRespondents] = useState<any>(null);
  const [linkedSpendId, setLinkedSpendId] = useState<string | null>(null);
  const [hasLinkedSpend, setHasLinkedSpend] = useState(false);

  useEffect(() => {
    if (isOpen && choiceId) {
      fetchReports();
    }
  }, [isOpen, choiceId]);

  const fetchReports = async () => {
    if (!user || !choiceId) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      const [itemsRes, usersRes, respondentsRes, linkedSpendRes] = await Promise.all([
        fetch(`/api/choices/${choiceId}/report/items`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/choices/${choiceId}/report/users`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/choices/${choiceId}/respondents`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch(`/api/choices/${choiceId}/linked-spend`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);

      setItemsReport(await itemsRes.json());
      setUsersReport(await usersRes.json());
      setRespondents(await respondentsRes.json());

      const linkedSpendData = await linkedSpendRes.json();
      setHasLinkedSpend(linkedSpendData.hasSpend);
      setLinkedSpendId(linkedSpendData.spendId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: "items" | "users") => {
    if (!user || !choiceId) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/export?type=${type}&format=csv`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${choiceName.replace(/[^a-z0-9]/gi, "_")}_${type}.csv`;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSpend = async (mode: "byItem" | "byUser") => {
    if (!user || !choiceId) return;

    if (!confirm(`Create a spend for this?`)) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/create-spend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) throw new Error("Failed to create spend");

      const data = await response.json();

      // Update linked spend state
      setHasLinkedSpend(true);
      setLinkedSpendId(data.spendId);

      onClose();

      // Open the spend dialog
      onOpenSpend(data.spendId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoToSpend = () => {
    if (linkedSpendId) {
      onClose();
      onOpenSpend(linkedSpendId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{choiceName}</h2>
            <button onClick={onClose} className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Respondents Summary */}
          {respondents && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 flex flex-wrap gap-x-3 gap-y-1">
                <span>{respondents.respondedUserIds?.length || 0} chosen</span>
                <span>{respondents.optedOutUserIds?.length || 0} opted out</span>
                <span>{respondents.pendingUserIds?.length || 0} pending</span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setTab("items")}
              className={`px-4 py-2 font-medium ${
                tab === "items"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setTab("users")}
              className={`px-4 py-2 font-medium ${
                tab === "users"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              By User
            </button>
            <button
              onClick={() => setTab("respondents")}
              className={`px-4 py-2 font-medium ${
                tab === "respondents"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Respondents
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              {/* Items Report */}
              {tab === "items" && itemsReport && (
                <div className="space-y-3">
                  {itemsReport.items.map((item: any) => (
                    <div key={item.itemId} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{item.name}: {item.qtyTotal} </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                             {item.distinctUsers}
                             {item.distinctUsers === 1
                                ? " person"
                                : " people"}
                          </div>

                        </div>
                        {item.totalPrice && (
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            ${item.totalPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {itemsReport.grandTotalPrice && (
                    <div className="border-t-2 border-zinc-300 dark:border-zinc-600 pt-3 mt-3">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>TOTAL</span>
                        <span>${itemsReport.grandTotalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Opted Out Users Section */}
                  {itemsReport.optedOutUsers && itemsReport.optedOutUsers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                        <span className="text-orange-500">✗</span> Opted Out ({itemsReport.optedOutUsers.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {itemsReport.optedOutUsers.map((user: any) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full"
                          >
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName}
                                className="w-5 h-5 rounded-full"
                              />
                            )}
                            <span className="text-sm text-orange-800 dark:text-orange-200">
                              {user.displayName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleExport("items")}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    📊 Export to CSV
                  </button>
                  {itemsReport.grandTotalPrice > 0 && choiceStatus === "CLOSED" && (
                    hasLinkedSpend ? (
                      <button
                        onClick={handleGoToSpend}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        👉 Go to Spend
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateSpend("byItem")}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        💰 Create Spend (by Item)
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Users Report */}
              {tab === "users" && usersReport && (
                <div className="space-y-3">
                  {usersReport.users.map((userReport: any) => (
                    <div key={userReport.userId} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                      <div className="font-medium mb-2">{userReport.displayName || "User"}</div>
                      {userReport.note && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 italic">
                          Note: {userReport.note}
                        </div>
                      )}
                      <div className="space-y-1">
                        {userReport.lines.map((line: any, idx: number) => (
                          <div key={idx} className="text-sm flex justify-between">
                            <span>
                              {line.quantity}x {line.itemName}
                              {line.note && <span className="text-zinc-500 ml-2">({line.note})</span>}
                            </span>
                            {line.linePrice && <span>${line.linePrice.toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                      {userReport.userTotalPrice && (
                        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 font-semibold flex justify-between">
                          <span>Subtotal</span>
                          <span>${userReport.userTotalPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {usersReport.grandTotalPrice && (
                    <div className="border-t-2 border-zinc-300 dark:border-zinc-600 pt-3 mt-3">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>TOTAL</span>
                        <span>${usersReport.grandTotalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Opted Out Users Section */}
                  {usersReport.optedOutUsers && usersReport.optedOutUsers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                        <span className="text-orange-500">✗</span> Opted Out ({usersReport.optedOutUsers.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {usersReport.optedOutUsers.map((user: any) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full"
                          >
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName}
                                className="w-5 h-5 rounded-full"
                              />
                            )}
                            <span className="text-sm text-orange-800 dark:text-orange-200">
                              {user.displayName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleExport("users")}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    📊 Export to CSV
                  </button>
                  {usersReport.grandTotalPrice > 0 && choiceStatus === "CLOSED" && (
                    hasLinkedSpend ? (
                      <button
                        onClick={handleGoToSpend}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        👉 Go to Spend
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateSpend("byUser")}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        💰 Create Spend (by User)
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Respondents Tab */}
              {tab === "respondents" && respondents && (
                <div className="space-y-4">
                  {/* Who Has Chosen */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                      <span className="text-green-600">✓</span> Who Has Chosen ({respondents.respondedUsers?.length || 0})
                    </h3>
                    {respondents.respondedUsers && respondents.respondedUsers.length > 0 ? (
                      <div className="space-y-2">
                        {respondents.respondedUsers.map((user: any) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                          >
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName ?? "Unknown"}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {user.displayName ?? "Unknown"}
                              </div>
                            </div>
                            <span className="text-green-600 text-xl">✓</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-zinc-500 dark:text-zinc-400 text-sm italic p-3 bg-zinc-50 dark:bg-zinc-900/20 rounded-lg">
                        No one has made a choice yet
                      </div>
                    )}
                  </div>

                  {/* Who Isn't Going To (Opted Out) */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                      <span className="text-zinc-500">✗</span> Who Isn't Going To ({respondents.optedOutUsers?.length || 0})
                    </h3>
                    {respondents.optedOutUsers && respondents.optedOutUsers.length > 0 ? (
                      <div className="space-y-2">
                        {respondents.optedOutUsers.map((user: any) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg"
                          >
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName ?? "Unknown"}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {user.displayName ?? "Unknown"}
                              </div>
                            </div>
                            <span className="text-zinc-500 text-xl">✗</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-zinc-500 dark:text-zinc-400 text-sm italic p-3 bg-zinc-50 dark:bg-zinc-900/20 rounded-lg">
                        No one has opted out
                      </div>
                    )}
                  </div>

                  {/* Who Hasn't Chosen */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                      <span className="text-orange-600">⏳</span> Who Hasn't Chosen ({respondents.pendingUsers?.length || 0})
                    </h3>
                    {respondents.pendingUsers && respondents.pendingUsers.length > 0 ? (
                      <div className="space-y-2">
                        {respondents.pendingUsers.map((user: any) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                          >
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName ?? "Unknown"}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                {user.displayName ?? "Unknown"}
                              </div>
                            </div>
                            <span className="text-orange-600 text-xl">⏳</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-zinc-500 dark:text-zinc-400 text-sm italic p-3 bg-zinc-50 dark:bg-zinc-900/20 rounded-lg">
                        Everyone has responded!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
